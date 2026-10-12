package com.horsetransport.route;

import java.util.List;
import java.util.UUID;

import com.horsetransport.order.OrderNotFoundException;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserRole;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.HashSet;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.ArrayList;

@Service
public class RoutePlanService {

	private final TransportOrderRepository orderRepository;
	private final RoutePlanRepository routePlanRepository;
	private final RouteLegRepository routeLegRepository;
	private final CurrentUserProvider currentUserProvider;

	public RoutePlanService(TransportOrderRepository orderRepository,
			RoutePlanRepository routePlanRepository,
			RouteLegRepository routeLegRepository,
			CurrentUserProvider currentUserProvider) {
		this.orderRepository = orderRepository;
		this.routePlanRepository = routePlanRepository;
		this.routeLegRepository = routeLegRepository;
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
		return toResponse(routePlanRepository.save(routePlan));
	}

		private TransportOrder findAccessiblePlanningOrder(UUID orderId, UUID frcUserId) {
		return orderRepository.findAssignedFrcRoutePlanOrder(orderId, frcUserId)
				.orElseThrow(OrderNotFoundException::new);
	}

	private RoutePlanResponse toResponse(RoutePlan routePlan) {
		List<RouteLeg> legs = routeLegRepository.findAllByRoutePlanIdOrderBySequenceNoAsc(routePlan.getId());
		return RoutePlanResponse.from(routePlan, legs);
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

	private String normalize(String value) {
		return isBlank(value) ? null : value.trim();
	}

	private boolean isBlank(String value) {
		return value == null || value.isBlank();
	}
}
