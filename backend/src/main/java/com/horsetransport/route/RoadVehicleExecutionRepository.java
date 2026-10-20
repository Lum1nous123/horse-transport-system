package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RoadVehicleExecutionRepository extends JpaRepository<RoadVehicleExecution, UUID> {

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
