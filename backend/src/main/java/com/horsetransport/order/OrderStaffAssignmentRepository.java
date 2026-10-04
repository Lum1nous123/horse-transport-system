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

	@Query("select o from TransportOrder o where o.status = :status "
			+ "and not exists (select a.id from OrderStaffAssignment a where a.transportOrderId = o.id) "
			+ "order by o.approvedAt asc, o.id asc")
	@EntityGraph(attributePaths = "horses")
	List<TransportOrder> findUnassignedOrdersByStatus(@Param("status") OrderStatus status);
}
