package com.horsetransport.tracking;

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
import com.horsetransport.horse.Horse;
import com.horsetransport.horse.HorseRepository;
import com.horsetransport.order.OrderNotFoundException;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderHorse;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.route.AirLegExecution;
import com.horsetransport.route.AirLegExecutionRepository;
import com.horsetransport.route.Checkpoint;
import com.horsetransport.route.CheckpointRepository;
import com.horsetransport.route.RoadLegVehicle;
import com.horsetransport.route.RoadLegVehicleHorse;
import com.horsetransport.route.RoadLegVehicleHorseRepository;
import com.horsetransport.route.RoadLegVehicleRepository;
import com.horsetransport.route.RoadVehicleExecution;
import com.horsetransport.route.RoadVehicleExecutionRepository;
import com.horsetransport.route.RouteLeg;
import com.horsetransport.route.RouteLegRepository;
import com.horsetransport.route.RouteLegType;
import com.horsetransport.route.RoutePlan;
import com.horsetransport.route.RoutePlanNotFoundException;
import com.horsetransport.route.RoutePlanRepository;
import com.horsetransport.route.RoutePlanStatus;
import com.horsetransport.route.Vehicle;
import com.horsetransport.route.VehicleCheckpointArrival;
import com.horsetransport.route.VehicleCheckpointArrivalRepository;
import com.horsetransport.route.VehicleRepository;
import com.horsetransport.route.WelfareEventType;
import com.horsetransport.route.WelfareEvidence;
import com.horsetransport.route.WelfareEvidenceRepository;
import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class JourneyTrackingService {

	private final TransportOrderRepository orderRepository;
	private final RoutePlanRepository routePlanRepository;
	private final RouteLegRepository routeLegRepository;
	private final RoadLegVehicleRepository roadVehicleRepository;
	private final RoadLegVehicleHorseRepository roadVehicleHorseRepository;
	private final RoadVehicleExecutionRepository roadExecutionRepository;
	private final AirLegExecutionRepository airExecutionRepository;
	private final CheckpointRepository checkpointRepository;
	private final VehicleCheckpointArrivalRepository arrivalRepository;
	private final WelfareEvidenceRepository welfareRepository;
	private final ProofOfDeliveryRepository proofRepository;
	private final VehicleRepository vehicleRepository;
	private final HorseRepository horseRepository;
	private final UserRepository userRepository;
	private final CurrentUserProvider currentUserProvider;

	public JourneyTrackingService(TransportOrderRepository orderRepository,
			RoutePlanRepository routePlanRepository, RouteLegRepository routeLegRepository,
			RoadLegVehicleRepository roadVehicleRepository,
			RoadLegVehicleHorseRepository roadVehicleHorseRepository,
			RoadVehicleExecutionRepository roadExecutionRepository,
			AirLegExecutionRepository airExecutionRepository,
			CheckpointRepository checkpointRepository,
			VehicleCheckpointArrivalRepository arrivalRepository,
			WelfareEvidenceRepository welfareRepository,
			ProofOfDeliveryRepository proofRepository, VehicleRepository vehicleRepository,
			HorseRepository horseRepository, UserRepository userRepository,
			CurrentUserProvider currentUserProvider) {
		this.orderRepository = orderRepository;
		this.routePlanRepository = routePlanRepository;
		this.routeLegRepository = routeLegRepository;
		this.roadVehicleRepository = roadVehicleRepository;
		this.roadVehicleHorseRepository = roadVehicleHorseRepository;
		this.roadExecutionRepository = roadExecutionRepository;
		this.airExecutionRepository = airExecutionRepository;
		this.checkpointRepository = checkpointRepository;
		this.arrivalRepository = arrivalRepository;
		this.welfareRepository = welfareRepository;
		this.proofRepository = proofRepository;
		this.vehicleRepository = vehicleRepository;
		this.horseRepository = horseRepository;
		this.userRepository = userRepository;
		this.currentUserProvider = currentUserProvider;
	}

	@Transactional(readOnly = true)
	public JourneyTrackingResponse getTracking(UUID orderId) {
		TransportOrder order = findAccessibleOrder(orderId);
		RoutePlan plan = routePlanRepository.findByTransportOrderId(orderId)
				.filter(candidate -> candidate.getStatus() == RoutePlanStatus.APPROVED)
				.orElseThrow(RoutePlanNotFoundException::new);
		List<RouteLeg> legs = routeLegRepository
				.findAllByRoutePlanIdOrderBySequenceNoAsc(plan.getId());

		List<UUID> roadLegIds = legs.stream().filter(leg -> leg.getLegType() == RouteLegType.ROAD)
				.map(RouteLeg::getId).toList();
		List<UUID> airLegIds = legs.stream().filter(leg -> leg.getLegType() == RouteLegType.AIR)
				.map(RouteLeg::getId).toList();

		List<RoadLegVehicle> roadVehicles = roadLegIds.isEmpty() ? List.of()
				: roadVehicleRepository.findAllByRouteLegIdIn(roadLegIds);
		List<UUID> roadVehicleIds = roadVehicles.stream().map(RoadLegVehicle::getId).toList();
		List<RoadLegVehicleHorse> allocations = roadLegIds.isEmpty() ? List.of()
				: roadVehicleHorseRepository.findAllByRouteLegIdIn(roadLegIds);
		List<RoadVehicleExecution> roadExecutions = roadVehicleIds.isEmpty() ? List.of()
				: roadExecutionRepository.findAllByRoadLegVehicleIdIn(roadVehicleIds);
		List<AirLegExecution> airExecutions = airLegIds.isEmpty() ? List.of()
				: airExecutionRepository.findAllByRouteLegIdIn(airLegIds);
		List<Checkpoint> checkpoints = roadLegIds.isEmpty() ? List.of()
				: checkpointRepository.findAllByRouteLegIdIn(roadLegIds);

		List<UUID> roadExecutionIds = roadExecutions.stream().map(RoadVehicleExecution::getId).toList();
		List<UUID> airExecutionIds = airExecutions.stream().map(AirLegExecution::getId).toList();
		List<VehicleCheckpointArrival> arrivals = roadExecutionIds.isEmpty() ? List.of()
				: arrivalRepository.findAllByRoadVehicleExecutionIdIn(roadExecutionIds);
		List<WelfareEvidence> roadWelfare = roadExecutionIds.isEmpty() ? List.of()
				: welfareRepository.findAllByRoadVehicleExecutionIdIn(roadExecutionIds);
		List<WelfareEvidence> airWelfare = airExecutionIds.isEmpty() ? List.of()
				: welfareRepository.findAllByAirLegExecutionIdIn(airExecutionIds);
		List<ProofOfDelivery> roadProofs = roadExecutionIds.isEmpty() ? List.of()
				: proofRepository.findAllByRoadVehicleExecutionIdIn(roadExecutionIds);
		List<ProofOfDelivery> airProofs = airExecutionIds.isEmpty() ? List.of()
				: proofRepository.findAllByAirLegExecutionIdIn(airExecutionIds);

		TrackingData data = buildTrackingData(order, roadVehicles, allocations, roadExecutions,
				airExecutions, checkpoints, arrivals, roadWelfare, airWelfare, roadProofs, airProofs);
		List<JourneyTrackingResponse.Leg> legResponses = legs.stream()
				.map(leg -> toLeg(leg, data))
				.toList();

		return new JourneyTrackingResponse(order.getId(), order.getOrderCode(), order.getStatus(),
				order.getOriginAddress(), order.getOriginCountry(), order.getDestinationAddress(),
				order.getDestinationCountry(), order.getRequestedDepartureAt(), order.getDeliveredAt(),
				plan.getId(), plan.getStatus(), plan.getApprovedAt(), legResponses);
	}

	private TransportOrder findAccessibleOrder(UUID orderId) {
		UserRole role = currentUserProvider.getCurrentUserRole();
		if (role == UserRole.CUSTOMER) {
			return orderRepository.findByIdAndCustomerId(orderId, currentUserProvider.getCurrentUserId())
					.orElseThrow(OrderNotFoundException::new);
		}
		if (role == UserRole.LOGISTICS_MANAGER) {
			return orderRepository.findById(orderId).orElseThrow(OrderNotFoundException::new);
		}
		throw new AccessDeniedException("Only the owning Customer or a Logistics Manager can view journey tracking");
	}

	private TrackingData buildTrackingData(TransportOrder order, List<RoadLegVehicle> roadVehicles,
			List<RoadLegVehicleHorse> allocations, List<RoadVehicleExecution> roadExecutions,
			List<AirLegExecution> airExecutions, List<Checkpoint> checkpoints,
			List<VehicleCheckpointArrival> arrivals, List<WelfareEvidence> roadWelfare,
			List<WelfareEvidence> airWelfare, List<ProofOfDelivery> roadProofs,
			List<ProofOfDelivery> airProofs) {
		Map<UUID, Vehicle> vehiclesById = byId(
				vehicleRepository.findAllById(roadVehicles.stream().map(RoadLegVehicle::getVehicleId).toList()),
				Vehicle::getId);
		Map<UUID, TransportOrderHorse> orderHorsesById = byId(order.getHorses(), TransportOrderHorse::getId);
		Map<UUID, Horse> horsesById = byId(
				horseRepository.findAllById(order.getHorses().stream().map(TransportOrderHorse::getHorseId).toList()),
				Horse::getId);

		Set<UUID> staffIds = new HashSet<>();
		roadExecutions.forEach(execution -> {
			staffIds.add(execution.getDriverId());
			staffIds.add(execution.getEscortId());
		});
		airExecutions.forEach(execution -> staffIds.add(execution.getEscortId()));
		Map<UUID, UserAccount> usersById = byId(userRepository.findAllById(staffIds), UserAccount::getId);

		Map<UUID, List<RoadLegVehicle>> roadVehiclesByLeg = grouped(roadVehicles, RoadLegVehicle::getRouteLegId);
		Map<UUID, List<RoadLegVehicleHorse>> allocationsByVehicle = grouped(
				allocations, RoadLegVehicleHorse::getRoadLegVehicleId);
		Map<UUID, RoadVehicleExecution> roadExecutionsByVehicle = byId(
				roadExecutions, RoadVehicleExecution::getRoadLegVehicleId);
		Map<UUID, AirLegExecution> airExecutionsByLeg = byId(airExecutions, AirLegExecution::getRouteLegId);
		Map<UUID, List<Checkpoint>> checkpointsByLeg = grouped(checkpoints, Checkpoint::getRouteLegId);

		Map<ExecutionCheckpointKey, VehicleCheckpointArrival> arrivalsByExecutionCheckpoint = new HashMap<>();
		arrivals.forEach(arrival -> arrivalsByExecutionCheckpoint.put(
				new ExecutionCheckpointKey(arrival.getRoadVehicleExecutionId(), arrival.getCheckpointId()), arrival));
		Map<ExecutionCheckpointKey, WelfareEvidence> checkpointWelfare = new HashMap<>();
		Map<UUID, WelfareEvidence> finalRoadWelfare = new HashMap<>();
		for (WelfareEvidence evidence : roadWelfare) {
			if (evidence.getEventType() == WelfareEventType.CHECKPOINT) {
				checkpointWelfare.put(new ExecutionCheckpointKey(
						evidence.getRoadVehicleExecutionId(), evidence.getCheckpointId()), evidence);
			} else if (evidence.getEventType() == WelfareEventType.FINAL_DESTINATION) {
				finalRoadWelfare.put(evidence.getRoadVehicleExecutionId(), evidence);
			}
		}
		Map<UUID, WelfareEvidence> finalAirWelfare = airWelfare.stream()
				.filter(evidence -> evidence.getEventType() == WelfareEventType.FINAL_DESTINATION)
				.collect(Collectors.toMap(WelfareEvidence::getAirLegExecutionId, Function.identity()));
		Map<UUID, ProofOfDelivery> roadProofsByExecution = byId(
				roadProofs, ProofOfDelivery::getRoadVehicleExecutionId);
		Map<UUID, ProofOfDelivery> airProofsByExecution = byId(
				airProofs, ProofOfDelivery::getAirLegExecutionId);

		return new TrackingData(vehiclesById, orderHorsesById, horsesById, usersById,
				roadVehiclesByLeg, allocationsByVehicle, roadExecutionsByVehicle,
				airExecutionsByLeg, checkpointsByLeg, arrivalsByExecutionCheckpoint,
				checkpointWelfare, finalRoadWelfare, finalAirWelfare,
				roadProofsByExecution, airProofsByExecution);
	}

	private JourneyTrackingResponse.Leg toLeg(RouteLeg leg, TrackingData data) {
		List<JourneyTrackingResponse.RoadVehicle> roadVehicles = List.of();
		JourneyTrackingResponse.AirExecution airExecution = null;
		if (leg.getLegType() == RouteLegType.ROAD) {
			roadVehicles = data.roadVehiclesByLeg().getOrDefault(leg.getId(), List.of()).stream()
					.sorted(Comparator.comparing(vehicle -> data.vehiclesById().get(vehicle.getVehicleId()).getPlateNumber()))
					.map(vehicle -> toRoadVehicle(vehicle, data))
					.toList();
		} else {
			AirLegExecution execution = data.airExecutionsByLeg().get(leg.getId());
			if (execution != null) airExecution = toAirExecution(execution, data);
		}
		return new JourneyTrackingResponse.Leg(leg.getId(), leg.getSequenceNo(), leg.getLegType(),
				leg.getStatus(), leg.getOrigin(), leg.getDestination(), leg.getPlannedDepartureAt(),
				leg.getPlannedArrivalAt(), leg.getStartedAt(), leg.getCompletedAt(),
				leg.getAirProviderName(), leg.getAirReference(), roadVehicles, airExecution);
	}

	private JourneyTrackingResponse.RoadVehicle toRoadVehicle(RoadLegVehicle roadVehicle,
			TrackingData data) {
		Vehicle vehicle = data.vehiclesById().get(roadVehicle.getVehicleId());
		RoadVehicleExecution execution = data.roadExecutionsByVehicle().get(roadVehicle.getId());
		List<JourneyTrackingResponse.Horse> horses = data.allocationsByVehicle()
				.getOrDefault(roadVehicle.getId(), List.of()).stream()
				.map(allocation -> toHorse(allocation, data))
				.sorted(Comparator.comparing(JourneyTrackingResponse.Horse::name))
				.toList();
		List<JourneyTrackingResponse.Checkpoint> checkpoints = data.checkpointsByLeg()
				.getOrDefault(roadVehicle.getRouteLegId(), List.of()).stream()
				.sorted(Comparator.comparing(Checkpoint::getSequenceNo))
				.map(checkpoint -> toCheckpoint(checkpoint, execution, data))
				.toList();
		UUID executionId = execution == null ? null : execution.getId();
		return new JourneyTrackingResponse.RoadVehicle(roadVehicle.getId(), vehicle.getId(),
				vehicle.getPlateNumber(), vehicle.getVehicleName(), vehicle.getVehicleType(),
				vehicle.getHorseCapacity(), executionId,
				execution == null ? null : execution.getStatus(),
				execution == null ? null : execution.getStartedAt(),
				execution == null ? null : execution.getDestinationArrivedAt(),
				execution == null ? null : execution.getCompletedAt(),
				execution == null ? null : toStaff(execution.getDriverId(), data),
				execution == null ? null : toStaff(execution.getEscortId(), data), horses, checkpoints,
				toWelfare(data.finalRoadWelfare().get(executionId)),
				toProof(data.roadProofsByExecution().get(executionId)));
	}

	private JourneyTrackingResponse.Horse toHorse(RoadLegVehicleHorse allocation, TrackingData data) {
		TransportOrderHorse orderHorse = data.orderHorsesById().get(allocation.getTransportOrderHorseId());
		Horse horse = data.horsesById().get(orderHorse.getHorseId());
		return new JourneyTrackingResponse.Horse(orderHorse.getId(), horse.getId(), horse.getName());
	}

	private JourneyTrackingResponse.Checkpoint toCheckpoint(Checkpoint checkpoint,
			RoadVehicleExecution execution, TrackingData data) {
		if (execution == null) return unreachedCheckpoint(checkpoint);
		ExecutionCheckpointKey key = new ExecutionCheckpointKey(execution.getId(), checkpoint.getId());
		VehicleCheckpointArrival arrival = data.arrivalsByExecutionCheckpoint().get(key);
		if (arrival == null) return unreachedCheckpoint(checkpoint);
		return new JourneyTrackingResponse.Checkpoint(checkpoint.getId(), checkpoint.getSequenceNo(),
				checkpoint.getName(), checkpoint.getCheckpointType(), checkpoint.getCountryCode(),
				checkpoint.getMinimumRequiredStopMinutes(), checkpoint.getPlannedStopDurationMinutes(),
				checkpoint.getNotes(), true, arrival.getArrivedAt(),
				toWelfare(data.checkpointWelfare().get(key)));
	}

	private JourneyTrackingResponse.Checkpoint unreachedCheckpoint(Checkpoint checkpoint) {
		return new JourneyTrackingResponse.Checkpoint(checkpoint.getId(), checkpoint.getSequenceNo(),
				checkpoint.getName(), checkpoint.getCheckpointType(), checkpoint.getCountryCode(),
				checkpoint.getMinimumRequiredStopMinutes(), checkpoint.getPlannedStopDurationMinutes(),
				checkpoint.getNotes(), false, null, null);
	}

	private JourneyTrackingResponse.AirExecution toAirExecution(AirLegExecution execution,
			TrackingData data) {
		return new JourneyTrackingResponse.AirExecution(execution.getId(), execution.getStatus(),
				execution.getStartedAt(), execution.getDestinationArrivedAt(), execution.getCompletedAt(),
				toStaff(execution.getEscortId(), data),
				toWelfare(data.finalAirWelfare().get(execution.getId())),
				toProof(data.airProofsByExecution().get(execution.getId())));
	}

	private JourneyTrackingResponse.StaffContact toStaff(UUID userId, TrackingData data) {
		UserAccount user = data.usersById().get(userId);
		return user == null ? null
				: new JourneyTrackingResponse.StaffContact(user.getFullName(), user.getPhone());
	}

	private JourneyTrackingResponse.Welfare toWelfare(WelfareEvidence evidence) {
		return evidence == null ? null : new JourneyTrackingResponse.Welfare(evidence.getId(),
				evidence.getEventType(), evidence.getPhotoUrl(), evidence.getNote(), evidence.getRecordedAt());
	}

	private JourneyTrackingResponse.ProofOfDelivery toProof(ProofOfDelivery proof) {
		return proof == null ? null : new JourneyTrackingResponse.ProofOfDelivery(proof.getId(),
				proof.getRecipientName(), proof.getProofPhotoUrl(), proof.getHandoverNote(), proof.getDeliveredAt());
	}

	private <T> Map<UUID, T> byId(Collection<T> values, Function<T, UUID> idFunction) {
		return values.stream().collect(Collectors.toMap(idFunction, Function.identity()));
	}

	private <T> Map<UUID, List<T>> grouped(Collection<T> values, Function<T, UUID> keyFunction) {
		return values.stream().collect(Collectors.groupingBy(keyFunction));
	}

	private record ExecutionCheckpointKey(UUID executionId, UUID checkpointId) {
	}

	private record TrackingData(
			Map<UUID, Vehicle> vehiclesById,
			Map<UUID, TransportOrderHorse> orderHorsesById,
			Map<UUID, Horse> horsesById,
			Map<UUID, UserAccount> usersById,
			Map<UUID, List<RoadLegVehicle>> roadVehiclesByLeg,
			Map<UUID, List<RoadLegVehicleHorse>> allocationsByVehicle,
			Map<UUID, RoadVehicleExecution> roadExecutionsByVehicle,
			Map<UUID, AirLegExecution> airExecutionsByLeg,
			Map<UUID, List<Checkpoint>> checkpointsByLeg,
			Map<ExecutionCheckpointKey, VehicleCheckpointArrival> arrivalsByExecutionCheckpoint,
			Map<ExecutionCheckpointKey, WelfareEvidence> checkpointWelfare,
			Map<UUID, WelfareEvidence> finalRoadWelfare,
			Map<UUID, WelfareEvidence> finalAirWelfare,
			Map<UUID, ProofOfDelivery> roadProofsByExecution,
			Map<UUID, ProofOfDelivery> airProofsByExecution) {
	}
}
