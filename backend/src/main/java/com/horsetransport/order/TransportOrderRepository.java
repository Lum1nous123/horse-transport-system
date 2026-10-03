package com.horsetransport.order;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TransportOrderRepository extends JpaRepository<TransportOrder, UUID> {

	@EntityGraph(attributePaths = "horses")
	List<TransportOrder> findAllByCustomerIdOrderByCreatedAtDesc(UUID customerId);

	@EntityGraph(attributePaths = "horses")
	Optional<TransportOrder> findByIdAndCustomerId(UUID id, UUID customerId);

	@EntityGraph(attributePaths = "horses")
	List<TransportOrder> findAllByStatusOrderByCreatedAtDesc(OrderStatus status);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select o from TransportOrder o where o.id = :id and o.customerId = :customerId")
	Optional<TransportOrder> findOwnedByIdForUpdate(@Param("id") UUID id, @Param("customerId") UUID customerId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select o from TransportOrder o where o.id = :id")
	Optional<TransportOrder> findByIdForUpdate(@Param("id") UUID id);

	@Query(value = "select nextval('transport_order_code_seq')", nativeQuery = true)
	long nextOrderCodeValue();
}
