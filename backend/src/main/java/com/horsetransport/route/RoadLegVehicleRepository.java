package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RoadLegVehicleRepository extends JpaRepository<RoadLegVehicle, UUID> {

	List<RoadLegVehicle> findAllByRouteLegId(UUID routeLegId);

	@Modifying
	void deleteAllByRouteLegId(UUID routeLegId);

	@Query("""
			select rlv
			from RoadLegVehicle rlv
			join RouteLeg leg on leg.id = rlv.routeLegId
			where rlv.vehicleId in :vehicleIds
				and rlv.routeLegId <> :excludedRouteLegId
				and :newStart < leg.plannedArrivalAt
				and :newEnd > leg.plannedDepartureAt
			""")
	List<RoadLegVehicle> findOverlappingAllocations(
			@Param("vehicleIds") Collection<UUID> vehicleIds,
			@Param("excludedRouteLegId") UUID excludedRouteLegId,
			@Param("newStart") LocalDateTime newStart,
			@Param("newEnd") LocalDateTime newEnd);
}