package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.horsetransport.delivery.ProofOfDelivery;
import com.horsetransport.delivery.ProofOfDeliveryRepository;
import com.horsetransport.delivery.ProofOfDeliveryResponse;
import com.horsetransport.horse.Horse;
import com.horsetransport.horse.HorseRepository;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderHorse;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.route.AirExecutionReadResponse.Summary;
import com.horsetransport.route.ExecutionReadComponents.AirActions;
import com.horsetransport.route.ExecutionReadComponents.HandoverProgress;
import com.horsetransport.route.ExecutionReadComponents.RoadActions;
import com.horsetransport.route.ExecutionReadComponents.RoadCheckpoint;
import com.horsetransport.route.ExecutionReadComponents.Staff;
import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import com.horsetransport.user.UserStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExecutionReadService {

	private final RoadVehicleExecutionRepository roadExecutionRepository;
	private final AirLegExecutionRepository airExecutionRepository;
	private final RoadLegVehicleRepository roadVehicleRepository;
	private final RoadLegVehicleHorseRepository allocationRepository;
	private final RouteLegRepository routeLegRepository;
	private final RoutePlanRepository routePlanRepository;
	private final TransportOrderRepository orderRepository;
	private final VehicleRepository vehicleRepository;
	private final CheckpointRepository checkpointRepository;
	private final VehicleCheckpointArrivalRepository arrivalRepository;
	private final WelfareEvidenceRepository welfareRepository;
	private final ProofOfDeliveryRepository proofRepository;
	private final HorseRepository horseRepository;
	private final UserRepository userRepository;
	private final CurrentUserProvider currentUserProvider;

	public ExecutionReadService(RoadVehicleExecutionRepository roadExecutionRepository,
			AirLegExecutionRepository airExecutionRepository,
			RoadLegVehicleRepository roadVehicleRepository,
			RoadLegVehicleHorseRepository allocationRepository,
			RouteLegRepository routeLegRepository, RoutePlanRepository routePlanRepository,
			TransportOrderRepository orderRepository, VehicleRepository vehicleRepository,
			CheckpointRepository checkpointRepository,
			VehicleCheckpointArrivalRepository arrivalRepository,
			WelfareEvidenceRepository welfareRepository, ProofOfDeliveryRepository proofRepository,
			HorseRepository horseRepository, UserRepository userRepository,
			CurrentUserProvider currentUserProvider) {
		this.roadExecutionRepository = roadExecutionRepository;
		this.airExecutionRepository = airExecutionRepository;
		this.roadVehicleRepository = roadVehicleRepository;
		this.allocationRepository = allocationRepository;
		this.routeLegRepository = routeLegRepository;
		this.routePlanRepository = routePlanRepository;
		this.orderRepository = orderRepository;
		this.vehicleRepository = vehicleRepository;
		this.checkpointRepository = checkpointRepository;
		this.arrivalRepository = arrivalRepository;
		this.welfareRepository = welfareRepository;
		this.proofRepository = proofRepository;
		this.horseRepository = horseRepository;
		this.userRepository = userRepository;
		this.currentUserProvider = currentUserProvider;
	}

	@Transactional(readOnly = true)
	public RoadExecutionReadResponse.Queue assignedRoad() {
		UserAccount actor = requireActiveActor(Set.of(UserRole.DRIVER, UserRole.ESCORT));
		List<RoadVehicleExecution> executions = actor.getRole() == UserRole.DRIVER
				? roadExecutionRepository.findActiveAssignedToDriver(actor.getId())
				: roadExecutionRepository.findActiveAssignedToEscort(actor.getId());
		RoadData data = loadRoadData(executions);
		return new RoadExecutionReadResponse.Queue(executions.stream()
				.map(execution -> roadSummary(execution, data)).toList());
	}

	@Transactional(readOnly = true)
	public RoadExecutionReadResponse.Detail roadDetail(UUID executionId) {
		UserAccount actor = requireActiveActor(Set.of(UserRole.DRIVER, UserRole.ESCORT));
		RoadVehicleExecution execution = (actor.getRole() == UserRole.DRIVER
				? roadExecutionRepository.findByIdAndDriverId(executionId, actor.getId())
				: roadExecutionRepository.findByIdAndEscortId(executionId, actor.getId()))
				.orElseThrow(ExecutionNotFoundException::new);
		RoadData data = loadRoadData(List.of(execution));
		RoadExecutionReadResponse.Summary summary = roadSummary(execution, data);
		RoadLegVehicle roadVehicle = required(data.roadVehicles(), execution.getRoadLegVehicleId());
		RouteLeg leg = required(data.legs(), roadVehicle.getRouteLegId());
		TransportOrder order = required(data.orders(), required(data.plans(), leg.getRoutePlanId()).getTransportOrderId());
		List<RoadLegVehicleHorse> allocations = data.allocationsByVehicle()
				.getOrDefault(roadVehicle.getId(), List.of());
		List<ExecutionReadComponents.Horse> horses = horseResponses(order, allocations, false);
		List<RoadCheckpoint> checkpoints = roadCheckpoints(execution, leg, data);
		WelfareEvidence finalWelfare = data.finalWelfare().get(execution.getId());
		ProofOfDelivery proof = data.proofs().get(execution.getId());
		RoadActions actions = roadActions(actor.getRole(), execution, leg, checkpoints,
				finalWelfare != null, proof != null, summary.isFinalLeg());
		Set<UUID> staffIds = Set.of(execution.getDriverId(), execution.getEscortId());
		Map<UUID, UserAccount> staff = byId(userRepository.findAllById(staffIds), UserAccount::getId);
		return new RoadExecutionReadResponse.Detail(summary.executionId(), summary.roadLegVehicleId(),
				summary.routeLegId(), summary.orderId(), summary.orderCode(), summary.orderStatus(),
				summary.routeLegSequenceNo(), summary.routeLegStatus(), summary.isFinalLeg(),
				summary.origin(), summary.destination(), summary.plannedDepartureAt(),
				summary.vehiclePlateNumber(), summary.vehicleName(), summary.horseCount(),
				summary.status(), summary.reachedCheckpointCount(), summary.pendingCheckpointWelfareCount(),
				execution.getAssignedAt(), execution.getStartedAt(), execution.getDestinationArrivedAt(),
				execution.getCompletedAt(), staff(execution.getDriverId(), staff),
				staff(execution.getEscortId(), staff), horses, checkpoints,
				toWelfare(finalWelfare), toProof(proof, leg, order, data, allocations),
				summary.proofOfDeliveryRecorded(), summary.proofOfDeliveryAvailable(),
				summary.handoverProgress(), actions,
				lastUpdated(execution.getAssignedAt(), execution.getStartedAt(),
						execution.getDestinationArrivedAt(), execution.getCompletedAt(), leg.getUpdatedAt(),
						maxArrival(checkpoints), maxCheckpointWelfare(checkpoints),
						finalWelfare == null ? null : finalWelfare.getRecordedAt(),
						proof == null ? null : proof.getCreatedAt()));
	}

	@Transactional(readOnly = true)
	public AirExecutionReadResponse.Queue assignedAir() {
		UserAccount actor = requireActiveActor(Set.of(UserRole.ESCORT));
		List<AirLegExecution> executions = airExecutionRepository.findActiveAssignedToEscort(actor.getId());
		AirData data = loadAirData(executions);
		return new AirExecutionReadResponse.Queue(executions.stream()
				.map(execution -> airSummary(execution, data)).toList());
	}

	@Transactional(readOnly = true)
	public AirExecutionReadResponse.Detail airDetail(UUID executionId) {
		UserAccount actor = requireActiveActor(Set.of(UserRole.ESCORT));
		AirLegExecution execution = airExecutionRepository.findByIdAndEscortId(executionId, actor.getId())
				.orElseThrow(ExecutionNotFoundException::new);
		AirData data = loadAirData(List.of(execution));
		Summary summary = airSummary(execution, data);
		RouteLeg leg = required(data.legs(), execution.getRouteLegId());
		TransportOrder order = required(data.orders(), required(data.plans(), leg.getRoutePlanId()).getTransportOrderId());
		WelfareEvidence welfare = data.welfare().get(execution.getId());
		ProofOfDelivery proof = data.proofs().get(execution.getId());
		Map<UUID, UserAccount> staff = byId(userRepository.findAllById(List.of(execution.getEscortId())),
				UserAccount::getId);
		return new AirExecutionReadResponse.Detail(summary.executionId(), summary.routeLegId(),
				summary.orderId(), summary.orderCode(), summary.orderStatus(), summary.routeLegSequenceNo(),
				summary.routeLegStatus(), summary.isFinalLeg(), summary.origin(), summary.destination(),
				summary.plannedDepartureAt(), summary.plannedArrivalAt(), summary.status(),
				execution.getAssignedAt(), execution.getStartedAt(), execution.getDestinationArrivedAt(),
				execution.getCompletedAt(), staff(execution.getEscortId(), staff), horseResponses(order, List.of(), true),
				toWelfare(welfare), toProof(proof, leg, order, data), summary.proofOfDeliveryRecorded(),
				summary.proofOfDeliveryAvailable(), summary.handoverProgress(), summary.availableActions(),
				lastUpdated(execution.getAssignedAt(), execution.getStartedAt(),
						execution.getDestinationArrivedAt(), execution.getCompletedAt(), leg.getUpdatedAt(),
						welfare == null ? null : welfare.getRecordedAt(), proof == null ? null : proof.getCreatedAt()));
	}

	private RoadData loadRoadData(List<RoadVehicleExecution> executions) {
		List<UUID> roadVehicleIds = executions.stream().map(RoadVehicleExecution::getRoadLegVehicleId).toList();
		Map<UUID, RoadLegVehicle> assignedRoadVehicles = byId(
				roadVehicleRepository.findAllById(roadVehicleIds), RoadLegVehicle::getId);
		List<UUID> legIds = assignedRoadVehicles.values().stream().map(RoadLegVehicle::getRouteLegId).distinct().toList();
		List<RoadLegVehicle> allLegVehicles = legIds.isEmpty() ? List.of()
				: roadVehicleRepository.findAllByRouteLegIdIn(legIds);
		Map<UUID, RoadLegVehicle> roadVehicles = byId(allLegVehicles, RoadLegVehicle::getId);
		Map<UUID, RouteLeg> legs = byId(routeLegRepository.findAllById(legIds), RouteLeg::getId);
		List<UUID> planIds = legs.values().stream().map(RouteLeg::getRoutePlanId).distinct().toList();
		Map<UUID, RoutePlan> plans = byId(routePlanRepository.findAllById(planIds), RoutePlan::getId);
		Map<UUID, TransportOrder> orders = byId(orderRepository.findAllById(plans.values().stream()
				.map(RoutePlan::getTransportOrderId).distinct().toList()), TransportOrder::getId);
		Map<UUID, Vehicle> vehicles = byId(vehicleRepository.findAllById(roadVehicles.values().stream()
				.map(RoadLegVehicle::getVehicleId).distinct().toList()), Vehicle::getId);
		List<RoadLegVehicleHorse> allocations = legIds.isEmpty() ? List.of()
				: allocationRepository.findAllByRouteLegIdIn(legIds);
		List<Checkpoint> checkpoints = legIds.isEmpty() ? List.of() : checkpointRepository.findAllByRouteLegIdIn(legIds);
		List<UUID> executionIds = executions.stream().map(RoadVehicleExecution::getId).toList();
		List<VehicleCheckpointArrival> arrivals = executionIds.isEmpty() ? List.of()
				: arrivalRepository.findAllByRoadVehicleExecutionIdIn(executionIds);
		List<WelfareEvidence> welfare = executionIds.isEmpty() ? List.of()
				: welfareRepository.findAllByRoadVehicleExecutionIdIn(executionIds);
		List<ProofOfDelivery> proofs = executionIds.isEmpty() ? List.of()
				: proofRepository.findAllByRoadVehicleExecutionIdIn(executionIds);
		List<RoadVehicleExecution> allLegExecutions = allLegVehicles.isEmpty() ? List.of()
				: roadExecutionRepository.findAllByRoadLegVehicleIdIn(allLegVehicles.stream()
						.map(RoadLegVehicle::getId).toList());
		List<ProofOfDelivery> allLegProofs = allLegExecutions.isEmpty() ? List.of()
				: proofRepository.findAllByRoadVehicleExecutionIdIn(allLegExecutions.stream()
						.map(RoadVehicleExecution::getId).toList());
		List<RouteLeg> planLegs = planIds.isEmpty() ? List.of() : routeLegRepository.findAllByRoutePlanIdIn(planIds);
		return new RoadData(roadVehicles, legs, plans, orders, vehicles,
				grouped(allocations, RoadLegVehicleHorse::getRoadLegVehicleId),
				grouped(checkpoints, Checkpoint::getRouteLegId), grouped(arrivals,
						VehicleCheckpointArrival::getRoadVehicleExecutionId),
				welfareByCheckpoint(welfare), finalWelfare(welfare), byId(proofs,
						ProofOfDelivery::getRoadVehicleExecutionId),
				finalSequences(planLegs), allLegExecutions.stream().collect(Collectors.groupingBy(
						execution -> required(roadVehicles, execution.getRoadLegVehicleId()).getRouteLegId(),
						Collectors.summingInt(item -> 1))),
				proofCounts(allLegProofs, allLegExecutions, roadVehicles));
	}

	private AirData loadAirData(List<AirLegExecution> executions) {
		List<UUID> legIds = executions.stream().map(AirLegExecution::getRouteLegId).toList();
		Map<UUID, RouteLeg> legs = byId(routeLegRepository.findAllById(legIds), RouteLeg::getId);
		List<UUID> planIds = legs.values().stream().map(RouteLeg::getRoutePlanId).distinct().toList();
		Map<UUID, RoutePlan> plans = byId(routePlanRepository.findAllById(planIds), RoutePlan::getId);
		Map<UUID, TransportOrder> orders = byId(orderRepository.findAllById(plans.values().stream()
				.map(RoutePlan::getTransportOrderId).distinct().toList()), TransportOrder::getId);
		List<UUID> executionIds = executions.stream().map(AirLegExecution::getId).toList();
		List<WelfareEvidence> welfare = executionIds.isEmpty() ? List.of()
				: welfareRepository.findAllByAirLegExecutionIdIn(executionIds);
		List<ProofOfDelivery> proofs = executionIds.isEmpty() ? List.of()
				: proofRepository.findAllByAirLegExecutionIdIn(executionIds);
		List<RouteLeg> planLegs = planIds.isEmpty() ? List.of() : routeLegRepository.findAllByRoutePlanIdIn(planIds);
		return new AirData(legs, plans, orders, finalAirWelfare(welfare),
				byId(proofs, ProofOfDelivery::getAirLegExecutionId), finalSequences(planLegs));
	}

	private RoadExecutionReadResponse.Summary roadSummary(RoadVehicleExecution execution, RoadData data) {
		RoadLegVehicle roadVehicle = required(data.roadVehicles(), execution.getRoadLegVehicleId());
		RouteLeg leg = required(data.legs(), roadVehicle.getRouteLegId());
		RoutePlan plan = required(data.plans(), leg.getRoutePlanId());
		TransportOrder order = required(data.orders(), plan.getTransportOrderId());
		Vehicle vehicle = required(data.vehicles(), roadVehicle.getVehicleId());
		List<VehicleCheckpointArrival> arrivals = data.arrivals().getOrDefault(execution.getId(), List.of());
		long pendingWelfare = arrivals.stream().filter(arrival -> !data.checkpointWelfare()
				.containsKey(new ExecutionCheckpointKey(execution.getId(), arrival.getCheckpointId()))).count();
		boolean finalLeg = leg.getSequenceNo().equals(data.finalSequenceByPlan().get(leg.getRoutePlanId()));
		boolean finalWelfare = data.finalWelfare().containsKey(execution.getId());
		boolean proof = data.proofs().containsKey(execution.getId());
		int required = finalLeg ? data.executionCountByLeg().getOrDefault(leg.getId(), 0) : 0;
		int completed = finalLeg ? data.proofCountByLeg().getOrDefault(leg.getId(), 0) : 0;
		return new RoadExecutionReadResponse.Summary(execution.getId(), roadVehicle.getId(), leg.getId(),
				order.getId(), order.getOrderCode(), order.getStatus(), leg.getSequenceNo(), leg.getStatus(), finalLeg,
				leg.getOrigin(), leg.getDestination(), leg.getPlannedDepartureAt(), vehicle.getPlateNumber(),
				vehicle.getVehicleName(), data.allocationsByVehicle().getOrDefault(roadVehicle.getId(), List.of()).size(),
				execution.getStatus(), arrivals.size(), (int) pendingWelfare, execution.getDestinationArrivedAt(),
				finalWelfare, proof, finalLeg && execution.getStatus() == ExecutionStatus.COMPLETED && !proof,
				new HandoverProgress(completed, required, leg.getStatus(), order.getStatus()));
	}

	private Summary airSummary(AirLegExecution execution, AirData data) {
		RouteLeg leg = required(data.legs(), execution.getRouteLegId());
		TransportOrder order = required(data.orders(), required(data.plans(), leg.getRoutePlanId()).getTransportOrderId());
		boolean finalLeg = leg.getSequenceNo().equals(data.finalSequenceByPlan().get(leg.getRoutePlanId()));
		boolean welfare = data.welfare().containsKey(execution.getId());
		boolean proof = data.proofs().containsKey(execution.getId());
		boolean proofAvailable = finalLeg && execution.getStatus() == ExecutionStatus.DESTINATION && welfare && !proof;
		AirActions actions = new AirActions(execution.getStatus() == ExecutionStatus.NOT_STARTED
				&& leg.getStatus() == RouteLegStatus.READY,
				execution.getStatus() == ExecutionStatus.IN_PROGRESS && leg.getStatus() == RouteLegStatus.IN_PROGRESS,
				execution.getStatus() == ExecutionStatus.DESTINATION && !welfare,
				!finalLeg && execution.getStatus() == ExecutionStatus.DESTINATION && welfare
						&& leg.getStatus() == RouteLegStatus.IN_PROGRESS);
		return new Summary(execution.getId(), leg.getId(), order.getId(), order.getOrderCode(), order.getStatus(),
				leg.getSequenceNo(), leg.getStatus(), finalLeg, leg.getOrigin(), leg.getDestination(),
				leg.getPlannedDepartureAt(), leg.getPlannedArrivalAt(), execution.getStatus(), welfare, proof,
				proofAvailable, new HandoverProgress(proof ? 1 : 0, finalLeg ? 1 : 0,
						leg.getStatus(), order.getStatus()), actions);
	}

	private List<RoadCheckpoint> roadCheckpoints(RoadVehicleExecution execution, RouteLeg leg, RoadData data) {
		Map<UUID, VehicleCheckpointArrival> arrivals = data.arrivals().getOrDefault(execution.getId(), List.of())
				.stream().collect(Collectors.toMap(VehicleCheckpointArrival::getCheckpointId, Function.identity()));
		return data.checkpointsByLeg().getOrDefault(leg.getId(), List.of()).stream()
				.sorted(Comparator.comparing(Checkpoint::getSequenceNo))
				.map(checkpoint -> {
					VehicleCheckpointArrival arrival = arrivals.get(checkpoint.getId());
					WelfareEvidence welfare = data.checkpointWelfare().get(
							new ExecutionCheckpointKey(execution.getId(), checkpoint.getId()));
					return new RoadCheckpoint(checkpoint.getId(), checkpoint.getSequenceNo(), checkpoint.getName(),
							checkpoint.getCheckpointType(), arrival == null ? null : arrival.getArrivedAt(),
							toWelfare(welfare));
				}).toList();
	}

	private RoadActions roadActions(UserRole role, RoadVehicleExecution execution, RouteLeg leg,
			List<RoadCheckpoint> checkpoints, boolean finalWelfare, boolean proof, boolean finalLeg) {
		if (role == UserRole.DRIVER) {
			List<RoadCheckpoint> pending = checkpoints.stream().filter(item -> item.arrivedAt() == null).toList();
			boolean reachedNeedWelfare = checkpoints.stream().anyMatch(item -> item.arrivedAt() != null
					&& item.welfareEvidence() == null);
			UUID next = execution.getStatus() == ExecutionStatus.IN_PROGRESS && !reachedNeedWelfare
					&& !pending.isEmpty() ? pending.get(0).id() : null;
			boolean destination = execution.getStatus() == ExecutionStatus.IN_PROGRESS
					&& !reachedNeedWelfare && pending.isEmpty();
			return new RoadActions(execution.getStatus() == ExecutionStatus.NOT_STARTED
					&& (leg.getStatus() == RouteLegStatus.READY
							|| leg.getStatus() == RouteLegStatus.IN_PROGRESS),
					next, destination, List.of(), false, false);
		}
		List<UUID> welfareIds = checkpoints.stream().filter(item -> item.arrivedAt() != null
				&& item.welfareEvidence() == null).map(RoadCheckpoint::id).toList();
		return new RoadActions(false, null, false, welfareIds,
				execution.getStatus() == ExecutionStatus.DESTINATION && !finalWelfare,
				finalLeg && execution.getStatus() == ExecutionStatus.COMPLETED && finalWelfare && !proof);
	}

	private List<ExecutionReadComponents.Horse> horseResponses(TransportOrder order,
			List<RoadLegVehicleHorse> allocations, boolean includeAllOrderHorses) {
		if (allocations.isEmpty() && !includeAllOrderHorses) return List.of();
		Map<UUID, TransportOrderHorse> orderHorses = byId(order.getHorses(), TransportOrderHorse::getId);
		Collection<TransportOrderHorse> selected = includeAllOrderHorses ? order.getHorses()
				: allocations.stream().map(item -> required(orderHorses, item.getTransportOrderHorseId())).toList();
		Map<UUID, Horse> horses = byId(horseRepository.findAllById(selected.stream()
				.map(TransportOrderHorse::getHorseId).toList()), Horse::getId);
		return selected.stream().map(orderHorse -> {
			Horse horse = required(horses, orderHorse.getHorseId());
			return new ExecutionReadComponents.Horse(horse.getId(), orderHorse.getId(), horse.getName(),
					horse.getMicrochipId());
		}).sorted(Comparator.comparing(ExecutionReadComponents.Horse::name)
				.thenComparing(ExecutionReadComponents.Horse::id)).toList();
	}

	private ProofOfDeliveryResponse toProof(ProofOfDelivery proof, RouteLeg leg, TransportOrder order,
			RoadData data, List<RoadLegVehicleHorse> allocations) {
		if (proof == null) return null;
		int required = data.executionCountByLeg().getOrDefault(leg.getId(), 0);
		int completed = data.proofCountByLeg().getOrDefault(leg.getId(), 0);
		return proofResponse(proof, leg, order, allocations.stream()
				.map(RoadLegVehicleHorse::getTransportOrderHorseId).sorted().toList(), completed, required);
	}

	private ProofOfDeliveryResponse toProof(ProofOfDelivery proof, RouteLeg leg, TransportOrder order,
			AirData data) {
		if (proof == null) return null;
		return proofResponse(proof, leg, order, order.getHorses().stream()
				.map(TransportOrderHorse::getId).sorted().toList(), 1, 1);
	}

	private ProofOfDeliveryResponse proofResponse(ProofOfDelivery proof, RouteLeg leg, TransportOrder order,
			List<UUID> horseIds, int completed, int required) {
		return new ProofOfDeliveryResponse(proof.getId(), proof.getRoadVehicleExecutionId(),
				proof.getAirLegExecutionId(), leg.getId(), horseIds, proof.getRecipientName(),
				proof.getProofPhotoUrl(), EvidenceDisplayName.proofOfDelivery(proof.getProofPhotoUrl()),
				proof.getHandoverNote(), proof.getConfirmedByEscortId(), proof.getDeliveredAt(),
				proof.getCreatedAt(), completed, required, leg.getStatus(), order.getStatus());
	}

	private WelfareEvidenceResponse toWelfare(WelfareEvidence evidence) {
		return evidence == null ? null : WelfareEvidenceResponse.from(evidence);
	}

	private UserAccount requireActiveActor(Set<UserRole> allowed) {
		UUID actorId = currentUserProvider.getCurrentUserId();
		UserRole role = currentUserProvider.getCurrentUserRole();
		if (!allowed.contains(role)) throw new AccessDeniedException("Execution role is not allowed");
		return userRepository.findById(actorId)
				.filter(user -> user.getStatus() == UserStatus.ACTIVE && user.getRole() == role)
				.orElseThrow(() -> new AccessDeniedException("Only active assigned staff can access executions"));
	}

	private Staff staff(UUID id, Map<UUID, UserAccount> users) {
		UserAccount user = required(users, id);
		return new Staff(user.getId(), user.getFullName());
	}

	private Map<ExecutionCheckpointKey, WelfareEvidence> welfareByCheckpoint(List<WelfareEvidence> values) {
		Map<ExecutionCheckpointKey, WelfareEvidence> result = new HashMap<>();
		values.stream().filter(item -> item.getEventType() == WelfareEventType.CHECKPOINT).forEach(item ->
				result.put(new ExecutionCheckpointKey(item.getRoadVehicleExecutionId(), item.getCheckpointId()), item));
		return result;
	}

	private Map<UUID, WelfareEvidence> finalWelfare(List<WelfareEvidence> values) {
		return values.stream().filter(item -> item.getEventType() == WelfareEventType.FINAL_DESTINATION)
				.collect(Collectors.toMap(WelfareEvidence::getRoadVehicleExecutionId, Function.identity()));
	}

	private Map<UUID, WelfareEvidence> finalAirWelfare(List<WelfareEvidence> values) {
		return values.stream().filter(item -> item.getEventType() == WelfareEventType.FINAL_DESTINATION)
				.collect(Collectors.toMap(WelfareEvidence::getAirLegExecutionId, Function.identity()));
	}

	private Map<UUID, Integer> finalSequences(List<RouteLeg> legs) {
		return legs.stream().collect(Collectors.toMap(RouteLeg::getRoutePlanId, RouteLeg::getSequenceNo, Math::max));
	}

	private Map<UUID, Integer> proofCounts(List<ProofOfDelivery> proofs,
			List<RoadVehicleExecution> executions, Map<UUID, RoadLegVehicle> roadVehicles) {
		Map<UUID, UUID> legByExecution = executions.stream().collect(Collectors.toMap(RoadVehicleExecution::getId,
				execution -> required(roadVehicles, execution.getRoadLegVehicleId()).getRouteLegId()));
		return proofs.stream().collect(Collectors.groupingBy(proof -> legByExecution.get(proof.getRoadVehicleExecutionId()),
				Collectors.summingInt(item -> 1)));
	}

	private LocalDateTime maxArrival(List<RoadCheckpoint> checkpoints) {
		return checkpoints.stream().map(RoadCheckpoint::arrivedAt).filter(java.util.Objects::nonNull)
				.max(LocalDateTime::compareTo).orElse(null);
	}

	private LocalDateTime maxCheckpointWelfare(List<RoadCheckpoint> checkpoints) {
		return checkpoints.stream().map(RoadCheckpoint::welfareEvidence)
				.filter(java.util.Objects::nonNull).map(WelfareEvidenceResponse::recordedAt)
				.filter(java.util.Objects::nonNull).max(LocalDateTime::compareTo).orElse(null);
	}

	private LocalDateTime lastUpdated(LocalDateTime... values) {
		LocalDateTime latest = null;
		for (LocalDateTime value : values) if (value != null && (latest == null || value.isAfter(latest))) latest = value;
		return latest;
	}

	private <T> Map<UUID, T> byId(Collection<T> values, Function<T, UUID> id) {
		return values.stream().collect(Collectors.toMap(id, Function.identity()));
	}

	private <T> Map<UUID, List<T>> grouped(Collection<T> values, Function<T, UUID> key) {
		return values.stream().collect(Collectors.groupingBy(key));
	}

	private <T> T required(Map<UUID, T> values, UUID id) {
		T value = values.get(id);
		if (value == null) throw new ExecutionNotFoundException();
		return value;
	}

	private record ExecutionCheckpointKey(UUID executionId, UUID checkpointId) { }

	private record RoadData(Map<UUID, RoadLegVehicle> roadVehicles, Map<UUID, RouteLeg> legs,
			Map<UUID, RoutePlan> plans, Map<UUID, TransportOrder> orders, Map<UUID, Vehicle> vehicles,
			Map<UUID, List<RoadLegVehicleHorse>> allocationsByVehicle,
			Map<UUID, List<Checkpoint>> checkpointsByLeg,
			Map<UUID, List<VehicleCheckpointArrival>> arrivals,
			Map<ExecutionCheckpointKey, WelfareEvidence> checkpointWelfare,
			Map<UUID, WelfareEvidence> finalWelfare, Map<UUID, ProofOfDelivery> proofs,
			Map<UUID, Integer> finalSequenceByPlan, Map<UUID, Integer> executionCountByLeg,
			Map<UUID, Integer> proofCountByLeg) { }

	private record AirData(Map<UUID, RouteLeg> legs, Map<UUID, RoutePlan> plans,
			Map<UUID, TransportOrder> orders, Map<UUID, WelfareEvidence> welfare,
			Map<UUID, ProofOfDelivery> proofs, Map<UUID, Integer> finalSequenceByPlan) { }
}
