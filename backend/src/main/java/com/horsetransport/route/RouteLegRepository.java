package com.horsetransport.route;

import java.util.List;
import java.util.UUID;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RouteLegRepository extends JpaRepository<RouteLeg, UUID> {

	List<RouteLeg> findAllByRoutePlanIdOrderBySequenceNoAsc(UUID routePlanId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select leg from RouteLeg leg where leg.routePlanId = :routePlanId order by leg.sequenceNo asc")
	List<RouteLeg> findAllByRoutePlanIdForUpdate(@Param("routePlanId") UUID routePlanId);

	boolean existsByRoutePlanIdAndSequenceNo(UUID routePlanId, Integer sequenceNo);
    	@Modifying
	@Query(value = "update route_legs set sequence_no = :sequenceNo where id = :id", nativeQuery = true)
	void updateSequence(@Param("id") UUID id, @Param("sequenceNo") Integer sequenceNo);
}
