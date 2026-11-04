package com.horsetransport.tracking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;

import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.route.RoutePlan;
import com.horsetransport.route.RoutePlanRepository;
import com.horsetransport.route.RoutePlanStatus;
import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserRole;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

@ExtendWith(MockitoExtension.class)
class LogisticsTrackingOrderServiceTest {
	@Mock TransportOrderRepository orders;
	@Mock RoutePlanRepository routePlans;
	@Mock CurrentUserProvider currentUser;

	@Test void logisticsManagerReceivesOnlyTheDedicatedTrackingQuery() {
		when(currentUser.getCurrentUserRole()).thenReturn(UserRole.LOGISTICS_MANAGER);
		when(orders.findAllByStatusInOrderByCreatedAtDesc(anyCollection())).thenReturn(List.of());
		assertThat(new LogisticsTrackingOrderService(orders, routePlans, currentUser).list()).isEmpty();
		verify(orders).findAllByStatusInOrderByCreatedAtDesc(anyCollection());
	}

	@Test void approvedOrderIsListedOnlyWhenItsRoutePlanIsApproved() {
		when(currentUser.getCurrentUserRole()).thenReturn(UserRole.LOGISTICS_MANAGER);
		TransportOrder trackable = order(UUID.randomUUID());
		TransportOrder withoutPlan = order(UUID.randomUUID());
		TransportOrder withDraftPlan = order(UUID.randomUUID());
		when(trackable.getOrderCode()).thenReturn("ORD-TRACKABLE");
		when(trackable.getHorses()).thenReturn(List.of());
		when(orders.findAllByStatusInOrderByCreatedAtDesc(anyCollection()))
				.thenReturn(List.of(trackable, withoutPlan, withDraftPlan));
		RoutePlan approved = plan(trackable.getId(), RoutePlanStatus.APPROVED);
		RoutePlan draft = plan(withDraftPlan.getId(), RoutePlanStatus.DRAFT);
		when(routePlans.findAllByTransportOrderIdIn(anyCollection())).thenReturn(List.of(approved, draft));

		assertThat(new LogisticsTrackingOrderService(orders, routePlans, currentUser).list())
				.extracting(LogisticsTrackingOrderResponse::orderCode)
				.containsExactly("ORD-TRACKABLE");
		verify(routePlans).findAllByTransportOrderIdIn(anyCollection());
	}

	@Test void nonLogisticsRoleCannotListOtherCustomersOrders() {
		when(currentUser.getCurrentUserRole()).thenReturn(UserRole.CUSTOMER);
		assertThatThrownBy(() -> new LogisticsTrackingOrderService(orders, routePlans, currentUser).list())
				.isInstanceOf(AccessDeniedException.class);
	}

	private TransportOrder order(UUID id) {
		TransportOrder order = mock(TransportOrder.class);
		when(order.getId()).thenReturn(id);
		return order;
	}

	private RoutePlan plan(UUID orderId, RoutePlanStatus status) {
		RoutePlan plan = mock(RoutePlan.class);
		if (status == RoutePlanStatus.APPROVED) when(plan.getTransportOrderId()).thenReturn(orderId);
		when(plan.getStatus()).thenReturn(status);
		return plan;
	}
}
