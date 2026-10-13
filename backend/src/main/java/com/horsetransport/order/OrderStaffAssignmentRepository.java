package com.horsetransport.order;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderStaffAssignmentRepository extends JpaRepository<OrderStaffAssignment, UUID> {
	List<OrderStaffAssignment> findAllByTransportOrderIdOrderByAssignmentRole(UUID transportOrderId);

	boolean existsByTransportOrderId(UUID transportOrderId);

	boolean existsByTransportOrderIdAndAssignmentRoleAndUserId(UUID transportOrderId,
			OrderStaffRole assignmentRole, UUID userId);

	@Query("select o from TransportOrder o where o.status = :status and o.documentsLockedAt is null "
			+ "and exists (select a.id from OrderStaffAssignment a where a.transportOrderId = o.id "
			+ "and a.assignmentRole = com.horsetransport.order.OrderStaffRole.TRANSPORT_SPECIALIST "
			+ "and a.userId = :userId) order by o.createdAt desc, o.id asc")
	@EntityGraph(attributePaths = "horses")
	List<TransportOrder> findActionableDocumentsByStatusAndAssignedTransportSpecialist(
			@Param("status") OrderStatus status, @Param("userId") UUID userId);

	@Query("select o from TransportOrder o where o.status = :status "
			+ "and not exists (select a.id from OrderStaffAssignment a where a.transportOrderId = o.id) "
			+ "order by o.approvedAt asc, o.id asc")
	@EntityGraph(attributePaths = "horses")
	List<TransportOrder> findUnassignedOrdersByStatus(@Param("status") OrderStatus status);
}
