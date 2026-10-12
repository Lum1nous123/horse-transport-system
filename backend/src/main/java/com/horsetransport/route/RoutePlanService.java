package com.horsetransport.route;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.horsetransport.audit.AuditEntityType;
import com.horsetransport.audit.StatusAuditLog;
import com.horsetransport.audit.StatusAuditLogRepository;
import com.horsetransport.order.OrderNotFoundException;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserRole;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;


@Service
public class RoutePlanService {

    private final TransportOrderRepository orderRepository;
    private final RoutePlanRepository routePlanRepository;
    private final RouteLegRepository routeLegRepository;
    private final VehicleRepository vehicleRepository;
    private final RoadLegVehicleRepository roadLegVehicleRepository;
    private final RoadLegVehicleHorseRepository roadLegVehicleHorseRepository;
    private final CheckpointRepository checkpointRepository;
    private final RoutePlanReviewRepository routePlanReviewRepository;
    private final ExecutionStaffingService executionStaffingService;
    private final StatusAuditLogRepository auditLogRepository;
    private final CurrentUserProvider currentUserProvider;

	public RoutePlanService(TransportOrderRepository orderRepository,
		RoutePlanRepository routePlanRepository,
		RouteLegRepository routeLegRepository,
		VehicleRepository vehicleRepository,
		RoadLegVehicleRepository roadLegVehicleRepository,
		RoadLegVehicleHorseRepository roadLegVehicleHorseRepository,
		CheckpointRepository checkpointRepository,
		RoutePlanReviewRepository routePlanReviewRepository,
		ExecutionStaffingService executionStaffingService,
		StatusAuditLogRepository auditLogRepository,
		CurrentUserProvider currentUserProvider) {
	this.orderRepository = orderRepository;
	this.routePlanRepository = routePlanRepository;
	this.routeLegRepository = routeLegRepository;
	this.vehicleRepository = vehicleRepository;
	this.roadLegVehicleRepository = roadLegVehicleRepository;
	this.roadLegVehicleHorseRepository = roadLegVehicleHorseRepository;
	this.checkpointRepository = checkpointRepository;
	this.routePlanReviewRepository = routePlanReviewRepository;
	this.executionStaffingService = executionStaffingService;
	this.auditLogRepository = auditLogRepository;
	this.currentUserProvider = currentUserProvider;
}

	@Transactional
	public RoutePlanResponse createPlan(UUID orderId) {
		requireFrc();

		UUID frcUserId = currentUserProvider.getCurrentUserId();
		TransportOrder order = findAccessiblePlanningOrder(orderId, frcUserId);

		RoutePlan routePlan = routePlanRepository.findByTransportOrderId(order.getId())
				.orElseGet(() -> routePlanRepository.save(new RoutePlan(order.getId(), frcUserId)));

		return toResponse(routePlan);
	}

	@Transactional(readOnly = true)
	public RoutePlanResponse getPlan(UUID orderId) {
		requireFrc();

		UUID frcUserId = currentUserProvider.getCurrentUserId();
		TransportOrder order = findAccessiblePlanningOrder(orderId, frcUserId);

		RoutePlan routePlan = routePlanRepository.findByTransportOrderId(order.getId())
				.orElseThrow(RoutePlanNotFoundException::new);

		return toResponse(routePlan);
	}

    @Transactional(readOnly = true)
public List<VehicleCandidateResponse> listVehicleCandidates(UUID orderId, UUID legId) {
	requireFrc();

	UUID frcUserId = currentUserProvider.getCurrentUserId();
	TransportOrder order = findAccessiblePlanningOrder(orderId, frcUserId);
	RoutePlan routePlan = routePlanRepository.findByTransportOrderId(order.getId())
			.orElseThrow(RoutePlanNotFoundException::new);
	RouteLeg leg = findRoutePlanLeg(routePlan, legId);
	requireRoadLeg(leg);

	List<Vehicle> vehicles = vehicleRepository.findAllByOrderByPlateNumberAsc();
	Set<UUID> overlappingVehicleIds = findOverlappingVehicleIds(
			vehicles.stream().map(Vehicle::getId).toList(), leg);

	return vehicles.stream()
			.map(vehicle -> VehicleCandidateResponse.from(vehicle,
					selectabilityReasons(vehicle, overlappingVehicleIds)))
			.toList();
}

@Transactional(readOnly = true)
public RoadAllocationDetailResponse getRoadAllocation(UUID orderId, UUID legId) {
	requireFrc();

	UUID frcUserId = currentUserProvider.getCurrentUserId();
	TransportOrder order = findAccessiblePlanningOrder(orderId, frcUserId);
	RoutePlan routePlan = routePlanRepository.findByTransportOrderId(order.getId())
			.orElseThrow(RoutePlanNotFoundException::new);
	RouteLeg leg = findRoutePlanLeg(routePlan, legId);
	requireRoadLeg(leg);

	return toRoadAllocationDetail(leg);
}

@Transactional
public RoadAllocationDetailResponse allocateRoadVehicles(UUID orderId, UUID legId,
		RoadVehicleAllocationRequest request) {
	requireFrc();

	UUID frcUserId = currentUserProvider.getCurrentUserId();
	TransportOrder order = findAccessiblePlanningOrder(orderId, frcUserId);
	RoutePlan routePlan = routePlanRepository.findByTransportOrderId(order.getId())
			.orElseThrow(RoutePlanNotFoundException::new);
	requireEditable(routePlan);
	RouteLeg leg = findRoutePlanLeg(routePlan, legId);
	requireRoadLeg(leg);

	Map<UUID, Vehicle> vehiclesById = loadRequestedVehicles(request.vehicles().stream()
			.map(RoadVehicleAllocationRequest.VehicleHorseAllocationRequest::vehicleId)
			.toList());
	validateRoadAllocationRequest(order, leg, request, vehiclesById);

	roadLegVehicleHorseRepository.deleteAllByRouteLegId(leg.getId());
	roadLegVehicleRepository.deleteAllByRouteLegId(leg.getId());

	for (RoadVehicleAllocationRequest.VehicleHorseAllocationRequest requestedVehicle : request.vehicles()) {
		RoadLegVehicle roadLegVehicle = roadLegVehicleRepository.save(
				new RoadLegVehicle(leg.getId(), requestedVehicle.vehicleId()));
		List<RoadLegVehicleHorse> assignedHorses = requestedVehicle.orderHorseIds().stream()
				.map(orderHorseId -> new RoadLegVehicleHorse(
						leg.getId(), roadLegVehicle.getId(), orderHorseId))
				.toList();
		roadLegVehicleHorseRepository.saveAll(assignedHorses);
	}

	return toRoadAllocationDetail(leg);
    }

	@Transactional(readOnly = true)
public List<CheckpointResponse> getCheckpoints(UUID orderId, UUID legId) {
	requireFrc();

	UUID frcUserId = currentUserProvider.getCurrentUserId();
	TransportOrder order = findAccessiblePlanningOrder(orderId, frcUserId);
	RoutePlan routePlan = routePlanRepository.findByTransportOrderId(order.getId())
			.orElseThrow(RoutePlanNotFoundException::new);
	RouteLeg leg = findRoutePlanLeg(routePlan, legId);
	requireRoadLeg(leg);

	return checkpointRepository.findAllByRouteLegIdOrderBySequenceNoAsc(leg.getId()).stream()
			.map(CheckpointResponse::from)
			.toList();
}

@Transactional
public List<CheckpointResponse> updateCheckpoints(UUID orderId, UUID legId,
		UpdateCheckpointsRequest request) {
	requireFrc();

	UUID frcUserId = currentUserProvider.getCurrentUserId();
	TransportOrder order = findAccessiblePlanningOrder(orderId, frcUserId);
	RoutePlan routePlan = routePlanRepository.findByTransportOrderId(order.getId())
			.orElseThrow(RoutePlanNotFoundException::new);
	requireEditable(routePlan);

	RouteLeg leg = findRoutePlanLeg(routePlan, legId);
	requireRoadLeg(leg);
	validateCheckpointCollection(request);

	checkpointRepository.deleteAllByRouteLegId(leg.getId());

	List<Checkpoint> checkpoints = request.checkpoints().stream()
			.map(checkpoint -> new Checkpoint(
					leg.getId(),
					checkpoint.sequenceNo(),
					checkpoint.name().trim(),
					checkpoint.checkpointType(),
					normalize(checkpoint.countryCode()),
					checkpoint.minimumRequiredStopMinutes(),
					checkpoint.plannedStopDurationMinutes(),
					normalize(checkpoint.notes())))
			.toList();

	checkpointRepository.saveAll(checkpoints);

	return checkpointRepository.findAllByRouteLegIdOrderBySequenceNoAsc(leg.getId()).stream()
			.map(CheckpointResponse::from)
			.toList();
}

	@Transactional
	public RouteLegResponse addLeg(UUID orderId, UpsertRouteLegRequest request) {
		requireFrc();

		UUID frcUserId = currentUserProvider.getCurrentUserId();
		TransportOrder order = findAccessiblePlanningOrder(orderId, frcUserId);

		RoutePlan routePlan = routePlanRepository.findByTransportOrderId(order.getId())
				.orElseThrow(RoutePlanNotFoundException::new);

		requireEditable(routePlan);
		validateLegRequest(request);

		if (routeLegRepository.existsByRoutePlanIdAndSequenceNo(routePlan.getId(), request.sequenceNo())) {
			throw new RoutePlanValidationException("Route leg sequence number must be unique within the route plan");
		}

		RouteLeg leg = new RouteLeg(
				routePlan.getId(),
				request.sequenceNo(),
				request.legType(),
				request.origin().trim(),
				request.destination().trim(),
				request.plannedDepartureAt(),
				request.plannedArrivalAt(),
				normalize(request.airProviderName()),
				normalize(request.airReference()),
				request.airCapacityHorses(),
				normalize(request.equipmentDetails()),
				normalize(request.notes()));

		return RouteLegResponse.from(routeLegRepository.save(leg));
	}

    @Transactional
	public RouteLegResponse updateLeg(UUID orderId, UUID legId, UpsertRouteLegRequest request) {
		requireFrc();

		UUID frcUserId = currentUserProvider.getCurrentUserId();
		TransportOrder order = findAccessiblePlanningOrder(orderId, frcUserId);

		RoutePlan routePlan = routePlanRepository.findByTransportOrderId(order.getId())
				.orElseThrow(RoutePlanNotFoundException::new);

		requireEditable(routePlan);
		validateLegRequest(request);

		RouteLeg leg = routeLegRepository.findById(legId)
				.filter(existingLeg -> existingLeg.getRoutePlanId().equals(routePlan.getId()))
				.orElseThrow(RoutePlanNotFoundException::new);

		boolean sequenceTakenByAnotherLeg = routeLegRepository
				.findAllByRoutePlanIdOrderBySequenceNoAsc(routePlan.getId())
				.stream()
				.anyMatch(existingLeg -> existingLeg.getSequenceNo().equals(request.sequenceNo())
						&& !existingLeg.getId().equals(leg.getId()));

		if (sequenceTakenByAnotherLeg) {
			throw new RoutePlanValidationException("Route leg sequence number must be unique within the route plan");
		}

		leg.update(
				request.sequenceNo(),
				request.legType(),
				request.origin().trim(),
				request.destination().trim(),
				request.plannedDepartureAt(),
				request.plannedArrivalAt(),
				normalize(request.airProviderName()),
				normalize(request.airReference()),
				request.airCapacityHorses(),
				normalize(request.equipmentDetails()),
				normalize(request.notes()));

		return RouteLegResponse.from(routeLegRepository.save(leg));
	}

	@Transactional
	public void deleteLeg(UUID orderId, UUID legId) {
		requireFrc();

		UUID frcUserId = currentUserProvider.getCurrentUserId();
		TransportOrder order = findAccessiblePlanningOrder(orderId, frcUserId);

		RoutePlan routePlan = routePlanRepository.findByTransportOrderId(order.getId())
				.orElseThrow(RoutePlanNotFoundException::new);

		requireEditable(routePlan);

		RouteLeg leg = routeLegRepository.findById(legId)
				.filter(existingLeg -> existingLeg.getRoutePlanId().equals(routePlan.getId()))
				.orElseThrow(RoutePlanNotFoundException::new);

		    roadLegVehicleHorseRepository.deleteAllByRouteLegId(leg.getId());
            roadLegVehicleRepository.deleteAllByRouteLegId(leg.getId());
            checkpointRepository.deleteAllByRouteLegId(leg.getId());
            routeLegRepository.delete(leg);
	}

    	@Transactional
	public RoutePlanResponse reorderLegs(UUID orderId, ReorderRouteLegRequest request) {
		requireFrc();

		UUID frcUserId = currentUserProvider.getCurrentUserId();
		TransportOrder order = findAccessiblePlanningOrder(orderId, frcUserId);

		RoutePlan routePlan = routePlanRepository.findByTransportOrderId(order.getId())
				.orElseThrow(RoutePlanNotFoundException::new);

		requireEditable(routePlan);

		List<RouteLeg> existingLegs = routeLegRepository.findAllByRoutePlanIdOrderBySequenceNoAsc(routePlan.getId());
		if (request.legs().size() != existingLegs.size()) {
			throw new RoutePlanValidationException("Reorder request must include every route leg exactly once");
		}

		Map<UUID, RouteLeg> existingLegsById = existingLegs.stream()
				.collect(Collectors.toMap(RouteLeg::getId, Function.identity()));

		HashSet<UUID> requestedLegIds = new HashSet<>();
		HashSet<Integer> requestedSequences = new HashSet<>();

		for (ReorderRouteLegRequest.RouteLegSequenceRequest requestedLeg : request.legs()) {
			if (!existingLegsById.containsKey(requestedLeg.legId())) {
				throw new RoutePlanValidationException("Reorder request contains a route leg outside this route plan");
			}
			if (!requestedLegIds.add(requestedLeg.legId())) {
				throw new RoutePlanValidationException("Reorder request contains duplicate route legs");
			}
			if (!requestedSequences.add(requestedLeg.sequenceNo())) {
				throw new RoutePlanValidationException("Route leg sequence number must be unique within the route plan");
			}
		}

				for (RouteLeg existingLeg : existingLegs) {
			routeLegRepository.updateSequence(existingLeg.getId(), -existingLeg.getSequenceNo());
		}

		for (ReorderRouteLegRequest.RouteLegSequenceRequest requestedLeg : request.legs()) {
			routeLegRepository.updateSequence(requestedLeg.legId(), requestedLeg.sequenceNo());
		}

		return toResponse(routePlan);
	}

        @Transactional(readOnly = true)
	public RoutePlanValidationResponse validatePlan(UUID orderId) {
		requireFrc();

		UUID frcUserId = currentUserProvider.getCurrentUserId();
		TransportOrder order = findAccessiblePlanningOrder(orderId, frcUserId);

		RoutePlan routePlan = routePlanRepository.findByTransportOrderId(order.getId())
				.orElseThrow(RoutePlanNotFoundException::new);

		List<RouteLeg> legs = routeLegRepository.findAllByRoutePlanIdOrderBySequenceNoAsc(routePlan.getId());
		return validatePlan(order, legs);
	}

    	@Transactional
	public RoutePlanResponse submitPlan(UUID orderId) {
		requireFrc();

		UUID frcUserId = currentUserProvider.getCurrentUserId();
		TransportOrder order = findAccessiblePlanningOrder(orderId, frcUserId);

		RoutePlan routePlan = routePlanRepository.findByTransportOrderId(order.getId())
				.orElseThrow(RoutePlanNotFoundException::new);

		requireEditable(routePlan);

		List<RouteLeg> legs = routeLegRepository.findAllByRoutePlanIdOrderBySequenceNoAsc(routePlan.getId());
		RoutePlanValidationResponse validation = validatePlan(order, legs);
		if (!validation.valid()) {
			String message = validation.issues().stream()
					.findFirst()
					.map(RoutePlanValidationIssueResponse::message)
					.orElse("Route plan is not valid");
			throw new RoutePlanValidationException(message);
		}

		routePlan.submitForReview();
		RoutePlan savedPlan = routePlanRepository.save(routePlan);
		int submissionNo = routePlanReviewRepository.maxSubmissionNo(savedPlan.getId()) + 1;
		routePlanReviewRepository.save(new RoutePlanReview(savedPlan.getId(), submissionNo, frcUserId));
		return toResponse(savedPlan);
	}

	@Transactional(readOnly = true)
	public List<LmRoutePlanReviewInboxResponse> listLmReviewInbox() {
		requireLm();

		List<RoutePlanReview> reviews = routePlanReviewRepository
				.findAllByDecisionOrderBySubmittedAtAsc(RoutePlanReviewDecision.PENDING);
		Map<UUID, RoutePlan> routePlansById = routePlanRepository.findAllById(
						reviews.stream().map(RoutePlanReview::getRoutePlanId).toList())
				.stream()
				.collect(Collectors.toMap(RoutePlan::getId, Function.identity()));

		return reviews.stream()
				.filter(review -> routePlansById.containsKey(review.getRoutePlanId()))
				.map(review -> LmRoutePlanReviewInboxResponse.from(review, routePlansById.get(review.getRoutePlanId())))
				.toList();
	}

	@Transactional(readOnly = true)
	public LmRoutePlanReviewDetailResponse getLmReviewDetail(UUID orderId) {
		requireLm();

		RoutePlan routePlan = findPendingLmRoutePlan(orderId);
		RoutePlanReview review = findPendingReview(routePlan);
		List<RouteLeg> legs = routeLegRepository.findAllByRoutePlanIdOrderBySequenceNoAsc(routePlan.getId());
		return new LmRoutePlanReviewDetailResponse(
				toResponse(routePlan),
				RoutePlanReviewResponse.from(review),
				executionStaffingService.getStaffing(routePlan, legs),
				null);
	}

	@Transactional
	public LmRoutePlanReviewDetailResponse returnRoutePlan(UUID orderId, ReturnRoutePlanRequest request) {
		requireLm();
		if (isBlank(request.reason())) {
			throw new RoutePlanValidationException("Route plan return reason is required");
		}

		UUID lmUserId = currentUserProvider.getCurrentUserId();
		RoutePlan routePlan = findPendingLmRoutePlan(orderId);
		RoutePlanReview review = findPendingReview(routePlan);

		routePlan.returnToFrc();
		review.returnToFrc(lmUserId, request.reason().trim());
		RoutePlan savedPlan = routePlanRepository.save(routePlan);
		RoutePlanReview savedReview = routePlanReviewRepository.save(review);

		return new LmRoutePlanReviewDetailResponse(
				toResponse(savedPlan),
				RoutePlanReviewResponse.from(savedReview),
				ExecutionStaffingResponse.empty(),
				null);
	}

	@Transactional
	public LmRoutePlanReviewDetailResponse confirmRoutePlan(UUID orderId) {
		requireLm();

		UUID lmUserId = currentUserProvider.getCurrentUserId();
		TransportOrder order = orderRepository.findByIdForUpdate(orderId)
				.orElseThrow(OrderNotFoundException::new);
		RoutePlan routePlan = findPendingLmRoutePlan(orderId);
		RoutePlanReview review = findPendingReview(routePlan);
		List<RouteLeg> legs = routeLegRepository.findAllByRoutePlanIdOrderBySequenceNoAsc(routePlan.getId());

		RoutePlanValidationResponse validation = validatePlan(order, legs);
		if (!validation.valid()) {
			String message = validation.issues().stream()
					.findFirst()
					.map(RoutePlanValidationIssueResponse::message)
					.orElse("Route plan is not valid");
			throw new RoutePlanValidationException(message);
		}

		routePlan.approve();
		review.confirm(lmUserId);
		ExecutionStaffingResponse executionStaffing = executionStaffingService.assignStaff(routePlan, legs);
		OrderStatus previousOrderStatus = order.getStatus();
		order.markReadyToShip();
		RoutePlan savedPlan = routePlanRepository.save(routePlan);
		RoutePlanReview savedReview = routePlanReviewRepository.save(review);
		orderRepository.save(order);
		auditLogRepository.saveAndFlush(StatusAuditLog.systemTransition(
				AuditEntityType.TRANSPORT_ORDER,
				order.getId(),
				previousOrderStatus.name(),
				OrderStatus.READY_TO_SHIP.name()));

		return new LmRoutePlanReviewDetailResponse(
				toResponse(savedPlan),
				RoutePlanReviewResponse.from(savedReview),
				executionStaffing,
				order.getStatus());
	}

		private TransportOrder findAccessiblePlanningOrder(UUID orderId, UUID frcUserId) {
		return orderRepository.findAssignedFrcRoutePlanOrder(orderId, frcUserId)
				.orElseThrow(OrderNotFoundException::new);
	}

	private RoutePlan findPendingLmRoutePlan(UUID orderId) {
		RoutePlan routePlan = routePlanRepository.findByTransportOrderId(orderId)
				.orElseThrow(RoutePlanNotFoundException::new);
		if (routePlan.getStatus() != RoutePlanStatus.PENDING_LM_REVIEW) {
			throw new RoutePlanValidationException("Route plan is not pending Logistics Manager review");
		}
		return routePlan;
	}

	private RoutePlanReview findPendingReview(RoutePlan routePlan) {
		return routePlanReviewRepository
				.findFirstByRoutePlanIdAndDecisionOrderBySubmissionNoDesc(
						routePlan.getId(), RoutePlanReviewDecision.PENDING)
				.orElseThrow(() -> new RoutePlanValidationException(
						"Route plan review is no longer pending"));
	}

	private RoutePlanResponse toResponse(RoutePlan routePlan) {
	List<RouteLeg> legs = routeLegRepository.findAllByRoutePlanIdOrderBySequenceNoAsc(routePlan.getId());
	Map<UUID, List<Checkpoint>> checkpointsByLegId = checkpointRepository
			.findAllByRouteLegIdIn(legs.stream().map(RouteLeg::getId).toList())
			.stream()
			.collect(Collectors.groupingBy(
					Checkpoint::getRouteLegId,
					Collectors.collectingAndThen(
							Collectors.toList(),
							checkpoints -> checkpoints.stream()
									.sorted(Comparator.comparing(Checkpoint::getSequenceNo))
									.toList())));
	return RoutePlanResponse.from(routePlan, legs, checkpointsByLegId);
}

    private RouteLeg findRoutePlanLeg(RoutePlan routePlan, UUID legId) {
	return routeLegRepository.findById(legId)
			.filter(existingLeg -> existingLeg.getRoutePlanId().equals(routePlan.getId()))
			.orElseThrow(RoutePlanNotFoundException::new);
}

private void requireRoadLeg(RouteLeg leg) {
	if (leg.getLegType() != RouteLegType.ROAD) {
		throw new RoutePlanValidationException("Vehicle allocation is only available for ROAD route legs");
	}
}

private Map<UUID, Vehicle> loadRequestedVehicles(Collection<UUID> vehicleIds) {
	HashSet<UUID> uniqueVehicleIds = new HashSet<>(vehicleIds);
	if (uniqueVehicleIds.size() != vehicleIds.size()) {
		throw new RoutePlanValidationException("Vehicle allocation request contains duplicate vehicles");
	}

	Map<UUID, Vehicle> vehiclesById = vehicleRepository.findAllById(uniqueVehicleIds).stream()
			.collect(Collectors.toMap(Vehicle::getId, Function.identity()));
	if (vehiclesById.size() != uniqueVehicleIds.size()) {
		throw new RoutePlanValidationException("Vehicle allocation request contains unknown vehicles");
	}
	return vehiclesById;
}

private void validateRoadAllocationRequest(TransportOrder order, RouteLeg leg,
		RoadVehicleAllocationRequest request, Map<UUID, Vehicle> vehiclesById) {
	Set<UUID> orderHorseIds = order.getHorses().stream()
			.map(com.horsetransport.order.TransportOrderHorse::getId)
			.collect(Collectors.toSet());
	HashSet<UUID> requestedHorseIds = new HashSet<>();

	for (RoadVehicleAllocationRequest.VehicleHorseAllocationRequest requestedVehicle : request.vehicles()) {
		Vehicle vehicle = vehiclesById.get(requestedVehicle.vehicleId());
		if (vehicle.getStatus() == VehicleStatus.MAINTENANCE || vehicle.getStatus() == VehicleStatus.INACTIVE) {
			throw new RoutePlanValidationException("Vehicle is not selectable because it is " + vehicle.getStatus());
		}
		if (requestedVehicle.orderHorseIds().size() > vehicle.getHorseCapacity()) {
			throw new RoutePlanValidationException("Vehicle horse allocation exceeds vehicle capacity");
		}
		for (UUID orderHorseId : requestedVehicle.orderHorseIds()) {
			if (!orderHorseIds.contains(orderHorseId)) {
				throw new RoutePlanValidationException("Vehicle allocation request contains foreign Horse");
			}
			if (!requestedHorseIds.add(orderHorseId)) {
				throw new RoutePlanValidationException("Vehicle allocation request contains duplicate Horse");
			}
		}
	}

	if (!requestedHorseIds.equals(orderHorseIds)) {
		throw new RoutePlanValidationException("Every Horse in the Order must be allocated exactly once");
	}

	if (!findOverlappingVehicleIds(vehiclesById.keySet(), leg).isEmpty()) {
		throw new RoutePlanValidationException("Vehicle allocation overlaps an existing ROAD route leg");
	}
}

private Set<UUID> findOverlappingVehicleIds(Collection<UUID> vehicleIds, RouteLeg leg) {
	if (vehicleIds.isEmpty()) {
		return Set.of();
	}
	return roadLegVehicleRepository.findOverlappingAllocations(
					vehicleIds,
					leg.getId(),
					leg.getPlannedDepartureAt(),
					leg.getPlannedArrivalAt())
			.stream()
			.map(RoadLegVehicle::getVehicleId)
			.collect(Collectors.toSet());
}

private List<String> selectabilityReasons(Vehicle vehicle, Set<UUID> overlappingVehicleIds) {
	List<String> reasons = new ArrayList<>();
	if (vehicle.getStatus() == VehicleStatus.MAINTENANCE) {
		reasons.add("MAINTENANCE");
	}
	if (vehicle.getStatus() == VehicleStatus.INACTIVE) {
		reasons.add("INACTIVE");
	}
	if (vehicle.getHorseCapacity() == null || vehicle.getHorseCapacity() <= 0) {
		reasons.add("INVALID_CAPACITY");
	}
	if (overlappingVehicleIds.contains(vehicle.getId())) {
		reasons.add("OVERLAPPING_ROUTE_LEG");
	}
	return reasons;
}

private RoadAllocationDetailResponse toRoadAllocationDetail(RouteLeg leg) {
	List<RoadLegVehicle> roadVehicles = roadLegVehicleRepository.findAllByRouteLegId(leg.getId());
	List<RoadLegVehicleHorse> roadVehicleHorses = roadLegVehicleHorseRepository.findAllByRouteLegId(leg.getId());
	Map<UUID, Vehicle> vehiclesById = vehicleRepository.findAllById(
					roadVehicles.stream().map(RoadLegVehicle::getVehicleId).toList())
			.stream()
			.collect(Collectors.toMap(Vehicle::getId, Function.identity()));
	Map<UUID, List<UUID>> horseIdsByRoadVehicleId = roadVehicleHorses.stream()
			.collect(Collectors.groupingBy(
					RoadLegVehicleHorse::getRoadLegVehicleId,
					Collectors.mapping(RoadLegVehicleHorse::getTransportOrderHorseId, Collectors.toList())));

	List<RoadAllocationDetailResponse.RoadVehicleAllocationResponse> vehicleResponses = roadVehicles.stream()
			.sorted(Comparator.comparing(roadVehicle -> vehiclesById.get(roadVehicle.getVehicleId()).getPlateNumber()))
			.map(roadVehicle -> {
				Vehicle vehicle = vehiclesById.get(roadVehicle.getVehicleId());
				return new RoadAllocationDetailResponse.RoadVehicleAllocationResponse(
						roadVehicle.getId(),
						vehicle.getId(),
						vehicle.getPlateNumber(),
						vehicle.getVehicleName(),
						vehicle.getVehicleType(),
						vehicle.getHorseCapacity(),
						vehicle.getStatus(),
						horseIdsByRoadVehicleId.getOrDefault(roadVehicle.getId(), List.of()),
						roadVehicle.getAssignedAt());
			})
			.toList();

	return new RoadAllocationDetailResponse(leg.getId(), vehicleResponses);
    }

	private void validateCheckpointCollection(UpdateCheckpointsRequest request) {
	HashSet<Integer> sequences = new HashSet<>();

	for (UpdateCheckpointsRequest.CheckpointItemRequest checkpoint : request.checkpoints()) {
		if (checkpoint.sequenceNo() <= 0) {
			throw new RoutePlanValidationException("Checkpoint sequence number must be positive");
		}
		if (!sequences.add(checkpoint.sequenceNo())) {
			throw new RoutePlanValidationException("Checkpoint sequence number must be unique within the ROAD leg");
		}
		if (isBlank(checkpoint.name())) {
			throw new RoutePlanValidationException("Checkpoint name is required");
		}
		if (checkpoint.checkpointType() == CheckpointType.REST_STOP) {
			if (checkpoint.minimumRequiredStopMinutes() == null
					|| checkpoint.minimumRequiredStopMinutes() < 0
					|| checkpoint.plannedStopDurationMinutes() == null
					|| checkpoint.plannedStopDurationMinutes() < checkpoint.minimumRequiredStopMinutes()) {
				throw new RoutePlanValidationException(
						"REST_STOP checkpoints require planned stop duration to meet the minimum");
			}
		}
		else if (checkpoint.minimumRequiredStopMinutes() != null
				|| checkpoint.plannedStopDurationMinutes() != null) {
			throw new RoutePlanValidationException("Only REST_STOP checkpoints can include stop duration fields");
		}
	}
}


	private void requireEditable(RoutePlan routePlan) {
		if (!routePlan.isEditableByFrc()) {
			throw new RoutePlanNotEditableException();
		}
	}

	private void validateLegRequest(UpsertRouteLegRequest request) {
		if (!request.plannedDepartureAt().isBefore(request.plannedArrivalAt())) {
			throw new RoutePlanValidationException("Route leg planned departure must be before planned arrival");
		}

		if (request.legType() == RouteLegType.AIR) {
			if (isBlank(request.airProviderName()) || isBlank(request.airReference())
					|| request.airCapacityHorses() == null || request.airCapacityHorses() <= 0) {
				throw new RoutePlanValidationException(
						"AIR route legs require provider, reference, and positive horse capacity");
			}
			return;
		}

		if (!isBlank(request.airProviderName()) || !isBlank(request.airReference())
				|| request.airCapacityHorses() != null) {
			throw new RoutePlanValidationException("ROAD route legs must not include AIR provider fields");
		}
	}
    	private RoutePlanValidationResponse validatePlan(TransportOrder order, List<RouteLeg> legs) {
		List<RoutePlanValidationIssueResponse> issues = new ArrayList<>();

		if (legs.isEmpty()) {
			issues.add(new RoutePlanValidationIssueResponse(
					"EMPTY_ROUTE_PLAN",
					"Route plan must contain at least one route leg",
					null,
					null));
			return RoutePlanValidationResponse.failed(issues);
		}

		HashSet<Integer> sequences = new HashSet<>();
		for (RouteLeg leg : legs) {
			if (!sequences.add(leg.getSequenceNo())) {
				issues.add(new RoutePlanValidationIssueResponse(
						"DUPLICATE_SEQUENCE",
						"Route leg sequence number must be unique within the route plan",
						leg.getId(),
						leg.getSequenceNo()));
			}

			if (!leg.getPlannedDepartureAt().isBefore(leg.getPlannedArrivalAt())) {
				issues.add(new RoutePlanValidationIssueResponse(
						"INVALID_LEG_TIME",
						"Route leg planned departure must be before planned arrival",
						leg.getId(),
						leg.getSequenceNo()));
			}
			if (leg.getLegType() == RouteLegType.ROAD) {
				issues.addAll(validatePersistedRoadAllocation(order, leg));
			}
			if (leg.getLegType() == RouteLegType.AIR) {
				issues.addAll(validatePersistedAirConfiguration(order, leg));
			}
		}

		RouteLeg firstLeg = legs.get(0);
		if (!sameLocation(order.getOriginAddress(), firstLeg.getOrigin())) {
			issues.add(new RoutePlanValidationIssueResponse(
					"ORIGIN_BOUNDARY_MISMATCH",
					"First route leg origin must match the transport order origin",
					firstLeg.getId(),
					firstLeg.getSequenceNo()));
		}

		RouteLeg lastLeg = legs.get(legs.size() - 1);
		if (!sameLocation(order.getDestinationAddress(), lastLeg.getDestination())) {
			issues.add(new RoutePlanValidationIssueResponse(
					"DESTINATION_BOUNDARY_MISMATCH",
					"Last route leg destination must match the transport order destination",
					lastLeg.getId(),
					lastLeg.getSequenceNo()));
		}

		for (int i = 0; i < legs.size() - 1; i++) {
			RouteLeg current = legs.get(i);
			RouteLeg next = legs.get(i + 1);

			if (!sameLocation(current.getDestination(), next.getOrigin())) {
				issues.add(new RoutePlanValidationIssueResponse(
						"BROKEN_CONTINUITY",
						"Each route leg destination must match the next route leg origin",
						next.getId(),
						next.getSequenceNo()));
			}

			if (next.getPlannedDepartureAt().isBefore(current.getPlannedArrivalAt())) {
				issues.add(new RoutePlanValidationIssueResponse(
						"BROKEN_TIME_ORDER",
						"Each route leg must depart after the previous route leg arrives",
						next.getId(),
						next.getSequenceNo()));
			}
		}

		return issues.isEmpty()
				? RoutePlanValidationResponse.passed()
				: RoutePlanValidationResponse.failed(issues);
	}

    private List<RoutePlanValidationIssueResponse> validatePersistedRoadAllocation(TransportOrder order,
		RouteLeg leg) {
	List<RoutePlanValidationIssueResponse> issues = new ArrayList<>();
	List<RoadLegVehicle> roadVehicles = roadLegVehicleRepository.findAllByRouteLegId(leg.getId());
	if (roadVehicles.isEmpty()) {
		issues.add(new RoutePlanValidationIssueResponse(
				"ROAD_VEHICLE_ALLOCATION_REQUIRED",
				"Every ROAD route leg must have Vehicle and Horse allocation",
				leg.getId(),
				leg.getSequenceNo()));
		return issues;
	}

	Map<UUID, Vehicle> vehiclesById = vehicleRepository.findAllById(
					roadVehicles.stream().map(RoadLegVehicle::getVehicleId).toList())
			.stream()
			.collect(Collectors.toMap(Vehicle::getId, Function.identity()));
	List<RoadLegVehicleHorse> horseAllocations = roadLegVehicleHorseRepository.findAllByRouteLegId(leg.getId());
	Map<UUID, Long> horseCountByRoadVehicleId = horseAllocations.stream()
			.collect(Collectors.groupingBy(RoadLegVehicleHorse::getRoadLegVehicleId, Collectors.counting()));

	for (RoadLegVehicle roadVehicle : roadVehicles) {
		Vehicle vehicle = vehiclesById.get(roadVehicle.getVehicleId());
		if (vehicle == null || vehicle.getStatus() == VehicleStatus.MAINTENANCE
				|| vehicle.getStatus() == VehicleStatus.INACTIVE) {
			issues.add(new RoutePlanValidationIssueResponse(
					"ROAD_VEHICLE_NOT_SELECTABLE",
					"ROAD route leg contains a Vehicle that is no longer selectable",
					leg.getId(),
					leg.getSequenceNo()));
		}
		else if (horseCountByRoadVehicleId.getOrDefault(roadVehicle.getId(), 0L) > vehicle.getHorseCapacity()) {
			issues.add(new RoutePlanValidationIssueResponse(
					"ROAD_VEHICLE_CAPACITY_EXCEEDED",
					"ROAD route leg Vehicle allocation exceeds capacity",
					leg.getId(),
					leg.getSequenceNo()));
		}
	}

	Set<UUID> orderHorseIds = order.getHorses().stream()
			.map(com.horsetransport.order.TransportOrderHorse::getId)
			.collect(Collectors.toSet());
	Set<UUID> allocatedHorseIds = horseAllocations.stream()
			.map(RoadLegVehicleHorse::getTransportOrderHorseId)
			.collect(Collectors.toSet());
	if (!allocatedHorseIds.equals(orderHorseIds) || allocatedHorseIds.size() != horseAllocations.size()) {
		issues.add(new RoutePlanValidationIssueResponse(
				"ROAD_HORSE_ALLOCATION_INVALID",
				"Every Horse must be allocated exactly once in each ROAD route leg",
				leg.getId(),
				leg.getSequenceNo()));
	}

	if (!findOverlappingVehicleIds(roadVehicles.stream().map(RoadLegVehicle::getVehicleId).toList(), leg)
			.isEmpty()) {
		issues.add(new RoutePlanValidationIssueResponse(
				"ROAD_VEHICLE_OVERLAP",
				"ROAD route leg Vehicle allocation overlaps another planned ROAD interval",
				leg.getId(),
				leg.getSequenceNo()));
	}

	return issues;
   }  

	private List<RoutePlanValidationIssueResponse> validatePersistedAirConfiguration(TransportOrder order,
			RouteLeg leg) {
		List<RoutePlanValidationIssueResponse> issues = new ArrayList<>();
		if (isBlank(leg.getAirProviderName()) || isBlank(leg.getAirReference())
				|| leg.getAirCapacityHorses() == null || leg.getAirCapacityHorses() <= 0) {
			issues.add(new RoutePlanValidationIssueResponse(
					"AIR_CONFIGURATION_REQUIRED",
					"AIR route legs require provider, reference, and positive horse capacity",
					leg.getId(),
					leg.getSequenceNo()));
			return issues;
		}

		int horseCount = order.getHorses().size();
		if (leg.getAirCapacityHorses() < horseCount) {
			issues.add(new RoutePlanValidationIssueResponse(
					"AIR_CAPACITY_INSUFFICIENT",
					"AIR route leg capacity must cover every Horse in the Order",
					leg.getId(),
					leg.getSequenceNo()));
		}
		return issues;
	}

		private boolean sameLocation(String left, String right) {
		String normalizedLeft = normalize(left);
		String normalizedRight = normalize(right);
		return normalizedLeft != null && normalizedRight != null
				&& normalizedLeft.equalsIgnoreCase(normalizedRight);
	}

	private void requireFrc() {
		if (currentUserProvider.getCurrentUserRole() != UserRole.FLEET_ROUTE_COORDINATOR) {
			throw new AccessDeniedException("Only assigned Fleet and Route Coordinator can manage route plans");
		}
	}

	private void requireLm() {
		if (currentUserProvider.getCurrentUserRole() != UserRole.LOGISTICS_MANAGER) {
			throw new AccessDeniedException("Only Logistics Manager can review route plans");
		}
	}

	private String normalize(String value) {
		return isBlank(value) ? null : value.trim();
	}

	private boolean isBlank(String value) {
		return value == null || value.isBlank();
	}
}
