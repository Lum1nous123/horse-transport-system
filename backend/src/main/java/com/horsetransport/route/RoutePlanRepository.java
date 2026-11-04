package com.horsetransport.route;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RoutePlanRepository extends JpaRepository<RoutePlan, UUID> {

	Optional<RoutePlan> findByTransportOrderId(UUID transportOrderId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select plan from RoutePlan plan where plan.transportOrderId = :orderId")
	Optional<RoutePlan> findByTransportOrderIdForUpdate(@Param("orderId") UUID transportOrderId);

	List<RoutePlan> findAllByTransportOrderIdIn(Collection<UUID> transportOrderIds);
}
