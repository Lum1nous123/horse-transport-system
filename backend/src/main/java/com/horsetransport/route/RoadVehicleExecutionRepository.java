package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.util.Optional;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RoadVehicleExecutionRepository extends JpaRepository<RoadVehicleExecution, UUID> {

	Optional<RoadVehicleExecution> findByRoadLegVehicleId(UUID roadLegVehicleId);

	Optional<RoadVehicleExecution> findByIdAndDriverId(UUID id, UUID driverId);

	Optional<RoadVehicleExecution> findByIdAndEscortId(UUID id, UUID escortId);

	@Query(value = """
			select execution.* from road_vehicle_executions execution
			join road_leg_vehicles vehicle on vehicle.id = execution.road_leg_vehicle_id
			join route_legs leg on leg.id = vehicle.route_leg_id
			where execution.driver_id = :userId and (
				execution.status in ('NOT_STARTED', 'IN_PROGRESS', 'DESTINATION')
				or (execution.status = 'COMPLETED'
					and not exists (select 1 from proofs_of_delivery proof
						where proof.road_vehicle_execution_id = execution.id)
					and leg.sequence_no = (select max(other.sequence_no) from route_legs other
						where other.route_plan_id = leg.route_plan_id))
			)
			order by leg.planned_departure_at, leg.sequence_no, execution.id
			""", nativeQuery = true)
	List<RoadVehicleExecution> findActiveAssignedToDriver(@Param("userId") UUID userId);

	@Query(value = """
			select execution.* from road_vehicle_executions execution
			join road_leg_vehicles vehicle on vehicle.id = execution.road_leg_vehicle_id
			join route_legs leg on leg.id = vehicle.route_leg_id
			where execution.escort_id = :userId and (
				execution.status in ('NOT_STARTED', 'IN_PROGRESS', 'DESTINATION')
				or (execution.status = 'COMPLETED'
					and not exists (select 1 from proofs_of_delivery proof
						where proof.road_vehicle_execution_id = execution.id)
					and leg.sequence_no = (select max(other.sequence_no) from route_legs other
						where other.route_plan_id = leg.route_plan_id))
			)
			order by leg.planned_departure_at, leg.sequence_no, execution.id
			""", nativeQuery = true)
	List<RoadVehicleExecution> findActiveAssignedToEscort(@Param("userId") UUID userId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select execution from RoadVehicleExecution execution where execution.roadLegVehicleId = :vehicleId")
	java.util.Optional<RoadVehicleExecution> findByRoadLegVehicleIdForUpdate(
			@Param("vehicleId") UUID roadLegVehicleId);

	List<RoadVehicleExecution> findAllByRoadLegVehicleIdIn(Collection<UUID> roadLegVehicleIds);

	long countByDriverIdAndStatusIn(UUID driverId, Collection<ExecutionStatus> statuses);

	long countByEscortIdAndStatusIn(UUID escortId, Collection<ExecutionStatus> statuses);

	@Query("""
			select distinct execution.driverId
			from RoadVehicleExecution execution
			join RoadLegVehicle roadVehicle on roadVehicle.id = execution.roadLegVehicleId
			join RouteLeg leg on leg.id = roadVehicle.routeLegId
			where execution.driverId in :driverIds
				and execution.status in :activeStatuses
				and :newStart < leg.plannedArrivalAt
				and :newEnd > leg.plannedDepartureAt
			""")
	List<UUID> findOverlappingDriverIds(
			@Param("driverIds") Collection<UUID> driverIds,
			@Param("activeStatuses") Collection<ExecutionStatus> activeStatuses,
			@Param("newStart") LocalDateTime newStart,
			@Param("newEnd") LocalDateTime newEnd);

	@Query("""
			select distinct execution.escortId
			from RoadVehicleExecution execution
			join RoadLegVehicle roadVehicle on roadVehicle.id = execution.roadLegVehicleId
			join RouteLeg leg on leg.id = roadVehicle.routeLegId
			where execution.escortId in :escortIds
				and execution.status in :activeStatuses
				and :newStart < leg.plannedArrivalAt
				and :newEnd > leg.plannedDepartureAt
			""")
	List<UUID> findOverlappingEscortIds(
			@Param("escortIds") Collection<UUID> escortIds,
			@Param("activeStatuses") Collection<ExecutionStatus> activeStatuses,
			@Param("newStart") LocalDateTime newStart,
			@Param("newEnd") LocalDateTime newEnd);
}
