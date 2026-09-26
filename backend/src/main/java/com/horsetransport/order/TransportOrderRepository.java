package com.horsetransport.order;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransportOrderRepository extends JpaRepository<TransportOrder, UUID> {

	@EntityGraph(attributePaths = "horses")
	List<TransportOrder> findAllByCustomerIdOrderByCreatedAtDesc(UUID customerId);

	@EntityGraph(attributePaths = "horses")
	Optional<TransportOrder> findByIdAndCustomerId(UUID id, UUID customerId);
}
