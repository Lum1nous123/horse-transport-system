package com.horsetransport.order;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderStaffAssignmentRepository extends JpaRepository<OrderStaffAssignment, UUID> {
	List<OrderStaffAssignment> findAllByTransportOrderIdOrderByAssignmentRole(UUID transportOrderId);

	boolean existsByTransportOrderId(UUID transportOrderId);

	boolean existsByTransportOrderIdAndAssignmentRoleAndUserId(UUID transportOrderId,
			OrderStaffRole assignmentRole, UUID userId);

	@Query("select distinct o from TransportOrder o left join fetch o.horses "
			+ "where o.status = :status "
			+ "and exists (select a.id from OrderStaffAssignment a where a.transportOrderId = o.id "
			+ "and a.assignmentRole = com.horsetransport.order.OrderStaffRole.TRANSPORT_SPECIALIST "
			+ "and a.userId = :userId) order by o.createdAt desc, o.id asc")
	List<TransportOrder> findDocumentInboxByStatusAndAssignedTransportSpecialist(
			@Param("status") OrderStatus status, @Param("userId") UUID userId);

	@Query("select distinct o from TransportOrder o left join fetch o.horses where o.status = :status "
			+ "and not exists (select a.id from OrderStaffAssignment a where a.transportOrderId = o.id) "
			+ "order by o.approvedAt asc, o.id asc")
	List<TransportOrder> findUnassignedOrdersByStatus(@Param("status") OrderStatus status);

	@Query("select distinct o from TransportOrder o left join fetch o.horses "
			+ "where o.status not in :terminalStatuses "
			+ "and exists (select ts.id from OrderStaffAssignment ts where ts.transportOrderId = o.id "
			+ "and ts.assignmentRole = com.horsetransport.order.OrderStaffRole.TRANSPORT_SPECIALIST) "
			+ "and exists (select frc.id from OrderStaffAssignment frc where frc.transportOrderId = o.id "
			+ "and frc.assignmentRole = com.horsetransport.order.OrderStaffRole.FLEET_ROUTE_COORDINATOR) "
			+ "order by o.approvedAt desc, o.id asc")
	List<TransportOrder> findAssignedNonTerminalOrders(@Param("terminalStatuses") List<OrderStatus> terminalStatuses);
}
