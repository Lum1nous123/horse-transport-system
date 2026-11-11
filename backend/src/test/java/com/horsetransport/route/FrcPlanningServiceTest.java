package com.horsetransport.route;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Constructor;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.horsetransport.horse.Horse;
import com.horsetransport.horse.HorseRepository;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderHorse;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class FrcPlanningServiceTest {

	private static final UUID FRC_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final UUID CUSTOMER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
	private static final UUID ORDER_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
	private static final UUID FIRST_ORDER_HORSE_ID = UUID.fromString("44444444-4444-4444-4444-444444444444");
	private static final UUID SECOND_ORDER_HORSE_ID = UUID.fromString("55555555-5555-5555-5555-555555555555");
	private static final UUID FIRST_HORSE_ID = UUID.fromString("66666666-6666-6666-6666-666666666666");
	private static final UUID SECOND_HORSE_ID = UUID.fromString("77777777-7777-7777-7777-777777777777");

	@Mock private TransportOrderRepository orderRepository;
	@Mock private RoutePlanRepository routePlanRepository;
	@Mock private HorseRepository horseRepository;
	@Mock private CurrentUserProvider currentUserProvider;

	private FrcPlanningService service;

	@BeforeEach
	void setUp() {
		service = new FrcPlanningService(orderRepository, routePlanRepository, horseRepository, currentUserProvider);
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.FLEET_ROUTE_COORDINATOR);
		when(currentUserProvider.getCurrentUserId()).thenReturn(FRC_ID);
	}

	@Test
	void planningContextBatchLoadsAndReturnsHorseIdentity() {
		TransportOrder order = order();
		when(orderRepository.findFrcPlanningContextOrder(ORDER_ID, FRC_ID)).thenReturn(Optional.of(order));
		when(routePlanRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.empty());
		when(horseRepository.findAllById(any())).thenReturn(List.of(
				horse(FIRST_HORSE_ID, "Apollo", "MC-001"),
				horse(SECOND_HORSE_ID, "Bella", "MC-002")));

		FrcPlanningContextResponse response = service.getPlanningContext(ORDER_ID);

		assertThat(response.horses())
				.extracting(FrcPlanningHorseResponse::orderHorseId,
						FrcPlanningHorseResponse::horseId,
						FrcPlanningHorseResponse::horseName,
						FrcPlanningHorseResponse::microchipId)
				.containsExactly(
						org.assertj.core.groups.Tuple.tuple(FIRST_ORDER_HORSE_ID, FIRST_HORSE_ID, "Apollo", "MC-001"),
						org.assertj.core.groups.Tuple.tuple(SECOND_ORDER_HORSE_ID, SECOND_HORSE_ID, "Bella", "MC-002"));
		verify(horseRepository).findAllById(any());
	}

	private TransportOrder order() {
		try {
			Constructor<TransportOrder> constructor = TransportOrder.class.getDeclaredConstructor(UUID.class, String.class);
			constructor.setAccessible(true);
			TransportOrder order = constructor.newInstance(CUSTOMER_ID, "ORD-FRC-1");
			ReflectionTestUtils.setField(order, "id", ORDER_ID);
			ReflectionTestUtils.setField(order, "status", OrderStatus.APPROVED);
			List<TransportOrderHorse> horses = new ArrayList<>();
			horses.add(orderHorse(order, FIRST_ORDER_HORSE_ID, FIRST_HORSE_ID));
			horses.add(orderHorse(order, SECOND_ORDER_HORSE_ID, SECOND_HORSE_ID));
			ReflectionTestUtils.setField(order, "horses", horses);
			return order;
		}
		catch (ReflectiveOperationException exception) {
			throw new IllegalStateException(exception);
		}
	}

	private TransportOrderHorse orderHorse(TransportOrder order, UUID orderHorseId, UUID horseId) throws ReflectiveOperationException {
		Constructor<TransportOrderHorse> constructor = TransportOrderHorse.class.getDeclaredConstructor(TransportOrder.class, UUID.class);
		constructor.setAccessible(true);
		TransportOrderHorse orderHorse = constructor.newInstance(order, horseId);
		ReflectionTestUtils.setField(orderHorse, "id", orderHorseId);
		return orderHorse;
	}

	private Horse horse(UUID id, String name, String microchipId) {
		try {
			Constructor<Horse> constructor = Horse.class.getDeclaredConstructor();
			constructor.setAccessible(true);
			Horse horse = constructor.newInstance();
			ReflectionTestUtils.setField(horse, "id", id);
			ReflectionTestUtils.setField(horse, "name", name);
			ReflectionTestUtils.setField(horse, "microchipId", microchipId);
			return horse;
		}
		catch (ReflectiveOperationException exception) {
			throw new IllegalStateException(exception);
		}
	}
}
