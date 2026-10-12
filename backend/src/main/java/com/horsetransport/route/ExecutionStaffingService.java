package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import com.horsetransport.user.UserStatus;
import org.springframework.stereotype.Service;

@Service
public class ExecutionStaffingService {

	private static final Set<ExecutionStatus> ACTIVE_EXECUTION_STATUSES = EnumSet.of(
			ExecutionStatus.NOT_STARTED, ExecutionStatus.IN_PROGRESS, ExecutionStatus.DESTINATION);

	private final UserRepository userRepository;
	private final RoadLegVehicleRepository roadLegVehicleRepository;
	private final RoadVehicleExecutionRepository roadVehicleExecutionRepository;
	private final AirLegExecutionRepository airLegExecutionRepository;

	public ExecutionStaffingService(UserRepository userRepository,
			RoadLegVehicleRepository roadLegVehicleRepository,
			RoadVehicleExecutionRepository roadVehicleExecutionRepository,
			AirLegExecutionRepository airLegExecutionRepository) {
		this.userRepository = userRepository;
		this.roadLegVehicleRepository = roadLegVehicleRepository;
		this.roadVehicleExecutionRepository = roadVehicleExecutionRepository;
		this.airLegExecutionRepository = airLegExecutionRepository;
	}

	public ExecutionStaffingResponse assignStaff(RoutePlan routePlan, List<RouteLeg> legs) {
		List<RouteLeg> roadLegs = legs.stream()
				.filter(leg -> leg.getLegType() == RouteLegType.ROAD)
				.toList();
		List<RouteLeg> airLegs = legs.stream()
				.filter(leg -> leg.getLegType() == RouteLegType.AIR)
				.toList();

		List<RoadLegVehicle> roadVehicles = roadLegs.stream()
				.flatMap(leg -> roadLegVehicleRepository.findAllByRouteLegId(leg.getId()).stream())
				.toList();
		Map<UUID, RouteLeg> roadLegsById = roadLegs.stream()
				.collect(Collectors.toMap(RouteLeg::getId, Function.identity()));
		Map<UUID, RoadLegVehicle> roadVehiclesById = roadVehicles.stream()
				.collect(Collectors.toMap(RoadLegVehicle::getId, Function.identity()));
		Map<UUID, RoadVehicleExecution> existingRoadExecutions = roadVehicleExecutionRepository
				.findAllByRoadLegVehicleIdIn(roadVehiclesById.keySet())
				.stream()
				.collect(Collectors.toMap(RoadVehicleExecution::getRoadLegVehicleId, Function.identity()));
		Map<UUID, AirLegExecution> existingAirExecutions = airLegExecutionRepository
				.findAllByRouteLegIdIn(airLegs.stream().map(RouteLeg::getId).toList())
				.stream()
				.collect(Collectors.toMap(AirLegExecution::getRouteLegId, Function.identity()));

		List<UserAccount> drivers = activeUsers(UserRole.DRIVER);
		List<UserAccount> escorts = activeUsers(UserRole.ESCORT);
		Map<UUID, Long> driverCounts = activeDriverCounts(drivers);
		Map<UUID, Long> escortCounts = activeEscortCounts(escorts);
		List<PlannedAssignment> plannedDriverAssignments = new ArrayList<>();
		List<PlannedAssignment> plannedEscortAssignments = new ArrayList<>();

		List<RoadVehicleExecution> newRoadExecutions = new ArrayList<>();
		for (RoadLegVehicle roadVehicle : roadVehicles) {
			if (existingRoadExecutions.containsKey(roadVehicle.getId())) {
				continue;
			}
			RouteLeg leg = roadLegsById.get(roadVehicle.getRouteLegId());
			UUID driverId = selectDriver(drivers, driverCounts, plannedDriverAssignments, leg);
			UUID escortId = selectEscort(escorts, escortCounts, plannedEscortAssignments, leg);
			newRoadExecutions.add(new RoadVehicleExecution(roadVehicle.getId(), driverId, escortId));
			driverCounts.merge(driverId, 1L, Long::sum);
			escortCounts.merge(escortId, 1L, Long::sum);
			plannedDriverAssignments.add(new PlannedAssignment(driverId, leg.getPlannedDepartureAt(),
					leg.getPlannedArrivalAt()));
			plannedEscortAssignments.add(new PlannedAssignment(escortId, leg.getPlannedDepartureAt(),
					leg.getPlannedArrivalAt()));
		}

		List<AirLegExecution> newAirExecutions = new ArrayList<>();
		for (RouteLeg leg : airLegs) {
			if (existingAirExecutions.containsKey(leg.getId())) {
				continue;
			}
			UUID escortId = selectEscort(escorts, escortCounts, plannedEscortAssignments, leg);
			newAirExecutions.add(new AirLegExecution(leg.getId(), escortId));
			escortCounts.merge(escortId, 1L, Long::sum);
			plannedEscortAssignments.add(new PlannedAssignment(escortId, leg.getPlannedDepartureAt(),
					leg.getPlannedArrivalAt()));
		}

		roadVehicleExecutionRepository.saveAll(newRoadExecutions);
		airLegExecutionRepository.saveAll(newAirExecutions);

		return readBackStaffing(routePlan, roadVehiclesById, airLegs);
	}

	public ExecutionStaffingResponse getStaffing(RoutePlan routePlan, List<RouteLeg> legs) {
		List<RouteLeg> roadLegs = legs.stream()
				.filter(leg -> leg.getLegType() == RouteLegType.ROAD)
				.toList();
		List<RouteLeg> airLegs = legs.stream()
				.filter(leg -> leg.getLegType() == RouteLegType.AIR)
				.toList();
		Map<UUID, RoadLegVehicle> roadVehiclesById = roadLegs.stream()
				.flatMap(leg -> roadLegVehicleRepository.findAllByRouteLegId(leg.getId()).stream())
				.collect(Collectors.toMap(RoadLegVehicle::getId, Function.identity()));
		return readBackStaffing(routePlan, roadVehiclesById, airLegs);
	}

	private ExecutionStaffingResponse readBackStaffing(RoutePlan routePlan,
			Map<UUID, RoadLegVehicle> roadVehiclesById, List<RouteLeg> airLegs) {
		List<RoadVehicleExecution> roadExecutions = roadVehicleExecutionRepository
				.findAllByRoadLegVehicleIdIn(roadVehiclesById.keySet());
		List<AirLegExecution> airExecutions = airLegExecutionRepository
				.findAllByRouteLegIdIn(airLegs.stream().map(RouteLeg::getId).toList());

		if (routePlan.getStatus() == RoutePlanStatus.APPROVED
				&& (roadExecutions.size() != roadVehiclesById.size()
						|| airExecutions.size() != airLegs.size())) {
			throw new RoutePlanValidationException("Execution staff assignment is incomplete");
		}

		return new ExecutionStaffingResponse(
				roadExecutions.stream()
						.sorted(Comparator.comparing(execution ->
								roadVehiclesById.get(execution.getRoadLegVehicleId()).getAssignedAt()))
						.map(execution -> ExecutionStaffingResponse.RoadVehicleExecutionResponse.from(
								execution, roadVehiclesById.get(execution.getRoadLegVehicleId())))
						.toList(),
				airExecutions.stream()
						.sorted(Comparator.comparing(AirLegExecution::getAssignedAt))
						.map(ExecutionStaffingResponse.AirLegExecutionResponse::from)
						.toList());
	}

	private List<UserAccount> activeUsers(UserRole role) {
		return userRepository.findAllByRoleAndStatusOrderByIdAsc(role, UserStatus.ACTIVE);
	}

	private Map<UUID, Long> activeDriverCounts(List<UserAccount> drivers) {
		return drivers.stream()
				.collect(Collectors.toMap(UserAccount::getId,
						driver -> roadVehicleExecutionRepository.countByDriverIdAndStatusIn(
								driver.getId(), ACTIVE_EXECUTION_STATUSES)));
	}

	private Map<UUID, Long> activeEscortCounts(List<UserAccount> escorts) {
		return escorts.stream()
				.collect(Collectors.toMap(UserAccount::getId,
						escort -> roadVehicleExecutionRepository.countByEscortIdAndStatusIn(
								escort.getId(), ACTIVE_EXECUTION_STATUSES)
								+ airLegExecutionRepository.countByEscortIdAndStatusIn(
										escort.getId(), ACTIVE_EXECUTION_STATUSES)));
	}

	private UUID selectDriver(List<UserAccount> drivers, Map<UUID, Long> activeCounts,
			List<PlannedAssignment> plannedAssignments, RouteLeg leg) {
		if (drivers.isEmpty()) {
			throw new RoutePlanValidationException("No eligible Driver is available for ROAD execution staffing");
		}
		Set<UUID> overlappingDriverIds = new HashSet<>(roadVehicleExecutionRepository.findOverlappingDriverIds(
				drivers.stream().map(UserAccount::getId).toList(),
				ACTIVE_EXECUTION_STATUSES,
				leg.getPlannedDepartureAt(),
				leg.getPlannedArrivalAt()));

		return selectStaff(drivers, activeCounts, plannedAssignments, overlappingDriverIds, leg,
				"No eligible Driver is available for ROAD execution staffing");
	}

	private UUID selectEscort(List<UserAccount> escorts, Map<UUID, Long> activeCounts,
			List<PlannedAssignment> plannedAssignments, RouteLeg leg) {
		if (escorts.isEmpty()) {
			throw new RoutePlanValidationException("No eligible Escort is available for execution staffing");
		}
		Set<UUID> overlappingEscortIds = new HashSet<>(roadVehicleExecutionRepository.findOverlappingEscortIds(
				escorts.stream().map(UserAccount::getId).toList(),
				ACTIVE_EXECUTION_STATUSES,
				leg.getPlannedDepartureAt(),
				leg.getPlannedArrivalAt()));
		overlappingEscortIds.addAll(airLegExecutionRepository.findOverlappingEscortIds(
				escorts.stream().map(UserAccount::getId).toList(),
				ACTIVE_EXECUTION_STATUSES,
				leg.getPlannedDepartureAt(),
				leg.getPlannedArrivalAt()));

		return selectStaff(escorts, activeCounts, plannedAssignments, overlappingEscortIds, leg,
				"No eligible Escort is available for execution staffing");
	}

	private UUID selectStaff(List<UserAccount> staff, Map<UUID, Long> activeCounts,
			List<PlannedAssignment> plannedAssignments, Set<UUID> overlappingStaffIds, RouteLeg leg,
			String failureMessage) {
		return staff.stream()
				.filter(user -> !overlappingStaffIds.contains(user.getId()))
				.filter(user -> plannedAssignments.stream().noneMatch(assignment ->
						assignment.userId().equals(user.getId())
								&& overlaps(leg.getPlannedDepartureAt(), leg.getPlannedArrivalAt(),
										assignment.start(), assignment.end())))
				.sorted(Comparator
						.comparing((UserAccount user) -> activeCounts.getOrDefault(user.getId(), 0L))
						.thenComparing(UserAccount::getId))
				.map(UserAccount::getId)
				.findFirst()
				.orElseThrow(() -> new RoutePlanValidationException(failureMessage));
	}

	private boolean overlaps(LocalDateTime newStart, LocalDateTime newEnd,
			LocalDateTime existingStart, LocalDateTime existingEnd) {
		return newStart.isBefore(existingEnd) && newEnd.isAfter(existingStart);
	}

	private record PlannedAssignment(UUID userId, LocalDateTime start, LocalDateTime end) {
	}
}
