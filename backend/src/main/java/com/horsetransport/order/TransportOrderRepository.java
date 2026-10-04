package com.horsetransport.order;

import java.time.LocalDateTime;
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

	@Query(value = "select o.id from transport_orders o "
			+ "where o.status = 'APPROVED' "
			+ "and o.document_completion_deadline_at is not null "
			+ "and o.document_completion_deadline_at <= :now "
			+ "and o.documents_locked_at is null "
			+ "and o.documents_final_confirmed_at is null "
			+ "and exists (select 1 from payments p where p.transport_order_id = o.id "
			+ "and p.payment_type = 'DEPOSIT' and p.status = 'PAID') "
			+ "order by o.document_completion_deadline_at, o.id", nativeQuery = true)
	List<UUID> findDueDocumentDeadlineOrderIds(@Param("now") LocalDateTime now);
}
