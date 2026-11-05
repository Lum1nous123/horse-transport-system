package com.horsetransport.order;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.Collection;

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

	@EntityGraph(attributePaths = "horses")
	List<TransportOrder> findAllByStatusInOrderByCreatedAtDesc(Collection<OrderStatus> statuses);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select o from TransportOrder o where o.id = :id and o.customerId = :customerId")
	Optional<TransportOrder> findOwnedByIdForUpdate(@Param("id") UUID id, @Param("customerId") UUID customerId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select o from TransportOrder o where o.id = :id")
	Optional<TransportOrder> findByIdForUpdate(@Param("id") UUID id);

	@Query(value = "select nextval('transport_order_code_seq')", nativeQuery = true)
	long nextOrderCodeValue();

	@Query(value = """
			select o.*
			from transport_orders o
			join order_staff_assignments osa
				on osa.transport_order_id = o.id
			join payments p
				on p.transport_order_id = o.id
			left join route_plans rp
				on rp.transport_order_id = o.id
			where osa.assignment_role = 'FLEET_ROUTE_COORDINATOR'
				and osa.user_id = :frcUserId
				and p.payment_type = 'REMAINING_BALANCE'
				and p.status = 'PAID'
				and (
					rp.id is null
					or rp.status in ('DRAFT', 'RETURNED')
				)
			order by o.created_at desc
			""", nativeQuery = true)
	List<TransportOrder> findFrcPlanningQueue(@Param("frcUserId") UUID frcUserId);

	@Query(value = """
			select o.*
			from transport_orders o
			join order_staff_assignments osa
				on osa.transport_order_id = o.id
			join payments p
				on p.transport_order_id = o.id
			left join route_plans rp
				on rp.transport_order_id = o.id
			where o.id = :orderId
				and osa.assignment_role = 'FLEET_ROUTE_COORDINATOR'
				and osa.user_id = :frcUserId
				and p.payment_type = 'REMAINING_BALANCE'
				and p.status = 'PAID'
				and (
					rp.id is null
					or rp.status in ('DRAFT', 'RETURNED')
				)
			""", nativeQuery = true)
	Optional<TransportOrder> findFrcPlanningContextOrder(
			@Param("orderId") UUID orderId,
			@Param("frcUserId") UUID frcUserId);

	@Query(value = """
			select o.*
			from transport_orders o
			join order_staff_assignments osa
				on osa.transport_order_id = o.id
			join payments p
				on p.transport_order_id = o.id
			where o.id = :orderId
				and osa.assignment_role = 'FLEET_ROUTE_COORDINATOR'
				and osa.user_id = :frcUserId
				and p.payment_type = 'REMAINING_BALANCE'
				and p.status = 'PAID'
			""", nativeQuery = true)
	Optional<TransportOrder> findAssignedFrcRoutePlanOrder(
			@Param("orderId") UUID orderId,
			@Param("frcUserId") UUID frcUserId);

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
