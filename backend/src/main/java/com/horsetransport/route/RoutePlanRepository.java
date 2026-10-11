package com.horsetransport.route;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RoutePlanRepository extends JpaRepository<RoutePlan, UUID> {

	Optional<RoutePlan> findByTransportOrderId(UUID transportOrderId);

	List<RoutePlan> findAllByTransportOrderIdIn(Collection<UUID> transportOrderIds);
}
