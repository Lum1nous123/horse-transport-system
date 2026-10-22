package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AirLegExecutionRepository extends JpaRepository<AirLegExecution, UUID> {

	Optional<AirLegExecution> findByRouteLegId(UUID routeLegId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select execution from AirLegExecution execution where execution.routeLegId = :routeLegId")
	Optional<AirLegExecution> findByRouteLegIdForUpdate(@Param("routeLegId") UUID routeLegId);

	List<AirLegExecution> findAllByRouteLegIdIn(Collection<UUID> routeLegIds);

	long countByEscortIdAndStatusIn(UUID escortId, Collection<ExecutionStatus> statuses);

	@Query("""
			select distinct execution.escortId
			from AirLegExecution execution
			join RouteLeg leg on leg.id = execution.routeLegId
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
