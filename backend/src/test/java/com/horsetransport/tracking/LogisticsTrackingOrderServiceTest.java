package com.horsetransport.tracking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import com.horsetransport.order.TransportOrderRepository;
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
	@Mock CurrentUserProvider currentUser;

	@Test void logisticsManagerReceivesOnlyTheDedicatedTrackingQuery() {
		when(currentUser.getCurrentUserRole()).thenReturn(UserRole.LOGISTICS_MANAGER);
		when(orders.findAllByStatusInOrderByCreatedAtDesc(anyCollection())).thenReturn(List.of());
		assertThat(new LogisticsTrackingOrderService(orders, currentUser).list()).isEmpty();
		verify(orders).findAllByStatusInOrderByCreatedAtDesc(anyCollection());
	}

	@Test void nonLogisticsRoleCannotListOtherCustomersOrders() {
		when(currentUser.getCurrentUserRole()).thenReturn(UserRole.CUSTOMER);
		assertThatThrownBy(() -> new LogisticsTrackingOrderService(orders, currentUser).list())
				.isInstanceOf(AccessDeniedException.class);
	}
}
