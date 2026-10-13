package com.horsetransport.route;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.horsetransport.order.OrderNotFoundException;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderHorse;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserRole;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FrcPlanningService {

	private final TransportOrderRepository orderRepository;
	private final RoutePlanRepository routePlanRepository;
	private final CurrentUserProvider currentUserProvider;

	public FrcPlanningService(TransportOrderRepository orderRepository,
			RoutePlanRepository routePlanRepository,
			CurrentUserProvider currentUserProvider) {
		this.orderRepository = orderRepository;
		this.routePlanRepository = routePlanRepository;
		this.currentUserProvider = currentUserProvider;
	}

	@Transactional(readOnly = true)
	public List<FrcPlanningQueueItemResponse> getPlanningQueue() {
		requireFrc();

		UUID frcUserId = currentUserProvider.getCurrentUserId();
		List<TransportOrder> orders = orderRepository.findFrcPlanningQueue(frcUserId);

		Map<UUID, RoutePlan> routePlansByOrderId = routePlanRepository
				.findAllByTransportOrderIdIn(orders.stream()
						.map(TransportOrder::getId)
						.toList())
				.stream()
				.collect(Collectors.toMap(RoutePlan::getTransportOrderId, Function.identity()));

		return orders.stream()
				.map(order -> FrcPlanningQueueItemResponse.from(
						order,
						routePlansByOrderId.get(order.getId())))
				.toList();
	}
    	@Transactional(readOnly = true)
	public FrcPlanningContextResponse getPlanningContext(UUID orderId) {
		requireFrc();

		UUID frcUserId = currentUserProvider.getCurrentUserId();
		TransportOrder order = orderRepository.findFrcPlanningContextOrder(orderId, frcUserId)
				.orElseThrow(OrderNotFoundException::new);

		RoutePlan routePlan = routePlanRepository.findByTransportOrderId(order.getId())
				.orElse(null);

		List<FrcPlanningHorseResponse> horses = order.getHorses().stream()
				.map(this::toHorseResponse)
				.toList();

		return FrcPlanningContextResponse.from(order, horses, routePlan);
	}

	private FrcPlanningHorseResponse toHorseResponse(TransportOrderHorse orderHorse) {
		return new FrcPlanningHorseResponse(
				orderHorse.getId(),
				orderHorse.getHorseId());
	}

	private void requireFrc() {
		if (currentUserProvider.getCurrentUserRole() != UserRole.FLEET_ROUTE_COORDINATOR) {
			throw new AccessDeniedException("Only assigned Fleet and Route Coordinator can access planning queue");
		}
	}
}
