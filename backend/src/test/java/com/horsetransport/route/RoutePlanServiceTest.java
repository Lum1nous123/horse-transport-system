package com.horsetransport.route;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import java.lang.reflect.Constructor;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class RoutePlanServiceTest {

	private static final UUID FRC_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final UUID CUSTOMER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
	private static final UUID ORDER_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");

	@Mock private TransportOrderRepository orderRepository;
	@Mock private RoutePlanRepository routePlanRepository;
	@Mock private RouteLegRepository routeLegRepository;
	@Mock private CurrentUserProvider currentUserProvider;

	private RoutePlanService service;

	@BeforeEach
	void setUp() {
		service = new RoutePlanService(orderRepository, routePlanRepository, routeLegRepository,
				currentUserProvider);

		lenient().when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.FLEET_ROUTE_COORDINATOR);
		lenient().when(currentUserProvider.getCurrentUserId()).thenReturn(FRC_ID);
		lenient().when(orderRepository.findAssignedFrcRoutePlanOrder(ORDER_ID, FRC_ID))
				.thenReturn(Optional.of(order()));
		lenient().when(routeLegRepository.findAllByRoutePlanIdOrderBySequenceNoAsc(any()))
				.thenReturn(List.of());
	}

	@Test
	void createsPlanForAssignedFrcAndReturnsPersistedState() {
		when(routePlanRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.empty());
		when(routePlanRepository.save(any(RoutePlan.class))).thenAnswer(invocation -> invocation.getArgument(0));

		RoutePlanResponse response = service.createPlan(ORDER_ID);

		assertThat(response.transportOrderId()).isEqualTo(ORDER_ID);
		assertThat(response.createdBy()).isEqualTo(FRC_ID);
		assertThat(response.status()).isEqualTo(RoutePlanStatus.DRAFT);
		assertThat(response.legs()).isEmpty();
	}

	@Test
	void rejectsDuplicateLegSequenceOnAdd() {
		RoutePlan plan = routePlan();
		when(routePlanRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(plan));
		when(routeLegRepository.existsByRoutePlanIdAndSequenceNo(plan.getId(), 1)).thenReturn(true);

		assertThatThrownBy(() -> service.addLeg(ORDER_ID, roadLegRequest(1, "Stable A", "Airport")))
				.isInstanceOf(RoutePlanValidationException.class)
				.hasMessageContaining("unique");
	}

	@Test
	void validationReportsBoundaryAndContinuityIssues() {
		RoutePlan plan = routePlan();
		RouteLeg first = roadLeg(plan.getId(), 1, "Stable A", "Airport");
		RouteLeg second = roadLeg(plan.getId(), 2, "Other Airport", "Wrong Destination");

		when(routePlanRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(plan));
		when(routeLegRepository.findAllByRoutePlanIdOrderBySequenceNoAsc(plan.getId()))
				.thenReturn(List.of(first, second));

		RoutePlanValidationResponse response = service.validatePlan(ORDER_ID);

		assertThat(response.valid()).isFalse();
		assertThat(response.issues())
				.extracting(RoutePlanValidationIssueResponse::code)
				.contains("BROKEN_CONTINUITY", "DESTINATION_BOUNDARY_MISMATCH");
	}

	@Test
	void rejectsEmptySubmit() {
		RoutePlan plan = routePlan();
		when(routePlanRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(plan));
		when(routeLegRepository.findAllByRoutePlanIdOrderBySequenceNoAsc(plan.getId())).thenReturn(List.of());

		assertThatThrownBy(() -> service.submitPlan(ORDER_ID))
				.isInstanceOf(RoutePlanValidationException.class)
				.hasMessageContaining("at least one route leg");
	}

	@Test
	void submitsValidPlanForLmReview() {
		RoutePlan plan = routePlan();
		RouteLeg leg = roadLeg(plan.getId(), 1, "Stable A", "Destination Stable");

		when(routePlanRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(plan));
		when(routeLegRepository.findAllByRoutePlanIdOrderBySequenceNoAsc(plan.getId()))
				.thenReturn(List.of(leg));
		when(routePlanRepository.save(plan)).thenReturn(plan);

		RoutePlanResponse response = service.submitPlan(ORDER_ID);

		assertThat(response.status()).isEqualTo(RoutePlanStatus.PENDING_LM_REVIEW);
	}

	@Test
	void nonFrcCannotCreatePlan() {
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.CUSTOMER);

		assertThatThrownBy(() -> service.createPlan(ORDER_ID))
				.isInstanceOf(AccessDeniedException.class);
	}

	private RoutePlan routePlan() {
		return new RoutePlan(ORDER_ID, FRC_ID);
	}

	private RouteLeg roadLeg(UUID planId, int sequenceNo, String origin, String destination) {
		return new RouteLeg(
				planId,
				sequenceNo,
				RouteLegType.ROAD,
				origin,
				destination,
				LocalDateTime.of(2026, 10, 12, 8 + sequenceNo, 0),
				LocalDateTime.of(2026, 10, 12, 9 + sequenceNo, 0),
				null,
				null,
				null,
				null,
				null);
	}

	private UpsertRouteLegRequest roadLegRequest(int sequenceNo, String origin, String destination) {
		return new UpsertRouteLegRequest(
				sequenceNo,
				RouteLegType.ROAD,
				origin,
				destination,
				LocalDateTime.of(2026, 10, 12, 8, 0),
				LocalDateTime.of(2026, 10, 12, 10, 0),
				null,
				null,
				null,
				null,
				null);
	}

	private TransportOrder order() {
		try {
			Constructor<TransportOrder> constructor = TransportOrder.class
					.getDeclaredConstructor(UUID.class, String.class);
			constructor.setAccessible(true);
			TransportOrder order = constructor.newInstance(CUSTOMER_ID, "ORD-test");
			ReflectionTestUtils.setField(order, "id", ORDER_ID);
			ReflectionTestUtils.setField(order, "status", OrderStatus.APPROVED);
			ReflectionTestUtils.setField(order, "originAddress", "Stable A");
			ReflectionTestUtils.setField(order, "destinationAddress", "Destination Stable");
			return order;
		}
		catch (ReflectiveOperationException exception) {
			throw new IllegalStateException(exception);
		}
	}
}
