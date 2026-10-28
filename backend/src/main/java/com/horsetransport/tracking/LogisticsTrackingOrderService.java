package com.horsetransport.tracking;

import java.util.List;

import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserRole;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LogisticsTrackingOrderService {
	private static final List<OrderStatus> TRACKABLE = List.of(OrderStatus.APPROVED,
			OrderStatus.READY_TO_SHIP, OrderStatus.IN_PROGRESS, OrderStatus.DELIVERED);
	private final TransportOrderRepository orders;
	private final CurrentUserProvider currentUser;

	public LogisticsTrackingOrderService(TransportOrderRepository orders, CurrentUserProvider currentUser) {
		this.orders = orders;
		this.currentUser = currentUser;
	}

	@Transactional(readOnly = true)
	public List<LogisticsTrackingOrderResponse> list() {
		if (currentUser.getCurrentUserRole() != UserRole.LOGISTICS_MANAGER) {
			throw new AccessDeniedException("Only a Logistics Manager can list tracking Orders");
		}
		return orders.findAllByStatusInOrderByCreatedAtDesc(TRACKABLE).stream()
				.map(LogisticsTrackingOrderResponse::from).toList();
	}
}
