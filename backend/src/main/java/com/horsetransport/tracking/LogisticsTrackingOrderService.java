package com.horsetransport.tracking;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.route.RoutePlanRepository;
import com.horsetransport.route.RoutePlanStatus;
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
	private final RoutePlanRepository routePlans;
	private final CurrentUserProvider currentUser;

	public LogisticsTrackingOrderService(TransportOrderRepository orders, RoutePlanRepository routePlans,
			CurrentUserProvider currentUser) {
		this.orders = orders;
		this.routePlans = routePlans;
		this.currentUser = currentUser;
	}

	@Transactional(readOnly = true)
	public List<LogisticsTrackingOrderResponse> list() {
		if (currentUser.getCurrentUserRole() != UserRole.LOGISTICS_MANAGER) {
			throw new AccessDeniedException("Only a Logistics Manager can list tracking Orders");
		}
		List<TransportOrder> candidates = orders.findAllByStatusInOrderByCreatedAtDesc(TRACKABLE);
		if (candidates.isEmpty()) return List.of();
		Set<UUID> approvedOrderIds = routePlans.findAllByTransportOrderIdIn(
				candidates.stream().map(TransportOrder::getId).toList()).stream()
				.filter(plan -> plan.getStatus() == RoutePlanStatus.APPROVED)
				.map(plan -> plan.getTransportOrderId())
				.collect(Collectors.toSet());
		return candidates.stream()
				.filter(order -> approvedOrderIds.contains(order.getId()))
				.map(LogisticsTrackingOrderResponse::from).toList();
	}
}
