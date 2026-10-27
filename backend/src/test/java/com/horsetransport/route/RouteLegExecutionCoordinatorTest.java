package com.horsetransport.route;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.EntityManager;
import com.horsetransport.audit.AuditEntityType;
import com.horsetransport.audit.StatusAuditRecorder;
import com.horsetransport.notification.NotificationService;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.OrderDeliveredEvent;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class RouteLegExecutionCoordinatorTest {

	private static final UUID ORDER_ID = UUID.randomUUID();
	private static final UUID PLAN_ID = UUID.randomUUID();
	private static final UUID FIRST_LEG_ID = UUID.randomUUID();
	private static final UUID SECOND_LEG_ID = UUID.randomUUID();
	private static final UUID ESCORT_ID = UUID.randomUUID();

	@Mock private RouteLegRepository routeLegRepository;
	@Mock private RoutePlanRepository routePlanRepository;
	@Mock private TransportOrderRepository orderRepository;
	@Mock private RoadLegVehicleRepository roadLegVehicleRepository;
	@Mock private RoadVehicleExecutionRepository roadExecutionRepository;
	@Mock private AirLegExecutionRepository airExecutionRepository;
	@Mock private UserRepository userRepository;
	@Mock private CurrentUserProvider currentUserProvider;
	@Mock private StatusAuditRecorder auditRecorder;
	@Mock private NotificationService notificationService;
	@Mock private EntityManager entityManager;
	@Mock private ApplicationEventPublisher eventPublisher;

	private RoutePlan plan;
	private TransportOrder order;
	private RouteLeg firstLeg;
	private RouteLeg secondLeg;
	private RouteLegExecutionCoordinator coordinator;

	@BeforeEach
	void setUp() throws ReflectiveOperationException {
		coordinator = new RouteLegExecutionCoordinator(routeLegRepository, routePlanRepository,
				orderRepository, roadLegVehicleRepository, roadExecutionRepository,
				airExecutionRepository, userRepository, currentUserProvider, auditRecorder,
				notificationService, entityManager, eventPublisher,
				Clock.fixed(Instant.parse("2026-10-22T10:00:00Z"), ZoneOffset.UTC));
		plan = new RoutePlan(ORDER_ID, UUID.randomUUID());
		ReflectionTestUtils.setField(plan, "id", PLAN_ID);
		ReflectionTestUtils.setField(plan, "status", RoutePlanStatus.APPROVED);
		var constructor = TransportOrder.class.getDeclaredConstructor(UUID.class, String.class);
		constructor.setAccessible(true);
		order = constructor.newInstance(UUID.randomUUID(), "HT-TEST");
		ReflectionTestUtils.setField(order, "id", ORDER_ID);
		ReflectionTestUtils.setField(order, "status", OrderStatus.READY_TO_SHIP);
		firstLeg = leg(FIRST_LEG_ID, 1);
		firstLeg.markReady();
		secondLeg = leg(SECOND_LEG_ID, 2);
	}

	@Test
	void startsFirstLegAndMovesOrderToInProgressOnce() {
		prepare(FIRST_LEG_ID, List.of(firstLeg, secondLeg));
		when(currentUserProvider.getCurrentUserId()).thenReturn(ESCORT_ID);
		when(userRepository.findByIdForUpdate(ESCORT_ID)).thenReturn(Optional.of(escort()));
		when(airExecutionRepository.findByRouteLegId(FIRST_LEG_ID))
				.thenReturn(Optional.of(new AirLegExecution(FIRST_LEG_ID, ESCORT_ID)));

		coordinator.startCurrentLeg(FIRST_LEG_ID);

		assertThat(firstLeg.getStatus()).isEqualTo(RouteLegStatus.IN_PROGRESS);
		assertThat(firstLeg.getStartedAt()).isNotNull();
		assertThat(order.getStatus()).isEqualTo(OrderStatus.IN_PROGRESS);
		verify(orderRepository).save(order);
		verify(routeLegRepository).save(firstLeg);
		verify(auditRecorder).recordUserTransition(AuditEntityType.TRANSPORT_ORDER, ORDER_ID,
				OrderStatus.READY_TO_SHIP.name(), OrderStatus.IN_PROGRESS.name(), ESCORT_ID, null);
		verify(auditRecorder).recordUserTransition(AuditEntityType.ROUTE_LEG, FIRST_LEG_ID,
				RouteLegStatus.READY.name(), RouteLegStatus.IN_PROGRESS.name(), ESCORT_ID, null);
		verify(notificationService).createTripStarted(order.getCustomerId(), ORDER_ID);
	}

	@Test
	void laterRouteLegStartDoesNotCreateAnotherTripStartedNotification() {
		firstLeg.start();
		firstLeg.complete();
		secondLeg.markReady();
		ReflectionTestUtils.setField(order, "status", OrderStatus.IN_PROGRESS);
		prepare(SECOND_LEG_ID, List.of(firstLeg, secondLeg));
		when(currentUserProvider.getCurrentUserId()).thenReturn(ESCORT_ID);
		when(userRepository.findByIdForUpdate(ESCORT_ID)).thenReturn(Optional.of(escort()));
		when(airExecutionRepository.findByRouteLegId(SECOND_LEG_ID))
				.thenReturn(Optional.of(new AirLegExecution(SECOND_LEG_ID, ESCORT_ID)));

		coordinator.startCurrentLeg(SECOND_LEG_ID);

		assertThat(secondLeg.getStatus()).isEqualTo(RouteLegStatus.IN_PROGRESS);
		verify(notificationService, never()).createTripStarted(any(), any());
	}

	@Test
	void rejectsStartingALaterLegBeforeItsPredecessorCompletes() {
		secondLeg.markReady();
		prepare(SECOND_LEG_ID, List.of(firstLeg, secondLeg));

		assertThatThrownBy(() -> coordinator.startCurrentLeg(SECOND_LEG_ID))
				.isInstanceOf(ExecutionConflictException.class)
				.hasMessageContaining("earlier legs");
		verifyNoInteractions(auditRecorder);
	}

	@Test
	void completesOnlyNonFinalLegAndOpensExactlyNextLeg() {
		firstLeg.start();
		ReflectionTestUtils.setField(order, "status", OrderStatus.IN_PROGRESS);
		prepare(FIRST_LEG_ID, List.of(firstLeg, secondLeg));
		when(currentUserProvider.getCurrentUserId()).thenReturn(ESCORT_ID);
		when(userRepository.findByIdForUpdate(ESCORT_ID)).thenReturn(Optional.of(escort()));
		when(airExecutionRepository.findByRouteLegId(FIRST_LEG_ID))
				.thenReturn(Optional.of(new AirLegExecution(FIRST_LEG_ID, ESCORT_ID)));

		coordinator.completeNonFinalLeg(FIRST_LEG_ID);

		assertThat(firstLeg.getStatus()).isEqualTo(RouteLegStatus.COMPLETED);
		assertThat(firstLeg.getCompletedAt()).isNotNull();
		assertThat(secondLeg.getStatus()).isEqualTo(RouteLegStatus.READY);
		verify(routeLegRepository).saveAll(List.of(firstLeg, secondLeg));
		verify(auditRecorder).recordUserTransition(AuditEntityType.ROUTE_LEG, FIRST_LEG_ID,
				RouteLegStatus.IN_PROGRESS.name(), RouteLegStatus.COMPLETED.name(), ESCORT_ID, null);
		verify(auditRecorder).recordUserTransition(AuditEntityType.ROUTE_LEG, SECOND_LEG_ID,
				RouteLegStatus.PLANNED.name(), RouteLegStatus.READY.name(), ESCORT_ID, null);
		verify(notificationService).createRouteLegCompleted(order.getCustomerId(), ORDER_ID, FIRST_LEG_ID);
	}

	@Test
	void finalLegCannotUseTheNonFinalCompletionHook() {
		firstLeg.start();
		ReflectionTestUtils.setField(order, "status", OrderStatus.IN_PROGRESS);
		prepare(FIRST_LEG_ID, List.of(firstLeg));

		assertThatThrownBy(() -> coordinator.completeNonFinalLeg(FIRST_LEG_ID))
				.isInstanceOf(ExecutionConflictException.class)
				.hasMessageContaining("PoD handover");
		assertThat(firstLeg.getStatus()).isEqualTo(RouteLegStatus.IN_PROGRESS);
		verifyNoInteractions(auditRecorder);
	}

	@Test
	void finalLegCompletesOrderAuditsAndPublishesDeliveryEventWhenPodIsReady() {
		firstLeg.start();
		ReflectionTestUtils.setField(order, "status", OrderStatus.IN_PROGRESS);
		prepare(FIRST_LEG_ID, List.of(firstLeg));
		when(currentUserProvider.getCurrentUserId()).thenReturn(ESCORT_ID);
		when(userRepository.findByIdForUpdate(ESCORT_ID)).thenReturn(Optional.of(escort()));
		when(airExecutionRepository.findByRouteLegId(FIRST_LEG_ID))
				.thenReturn(Optional.of(new AirLegExecution(FIRST_LEG_ID, ESCORT_ID)));

		boolean completed = coordinator.completeFinalLegWhenReady(FIRST_LEG_ID, () -> true);

		assertThat(completed).isTrue();
		assertThat(firstLeg.getStatus()).isEqualTo(RouteLegStatus.COMPLETED);
		assertThat(order.getStatus()).isEqualTo(OrderStatus.DELIVERED);
		assertThat(order.getDeliveredAt()).isEqualTo(LocalDateTime.of(2026, 10, 22, 10, 0));
		verify(auditRecorder).recordUserTransition(AuditEntityType.ROUTE_LEG, FIRST_LEG_ID,
				RouteLegStatus.IN_PROGRESS.name(), RouteLegStatus.COMPLETED.name(), ESCORT_ID, null);
		verify(auditRecorder).recordUserTransition(AuditEntityType.TRANSPORT_ORDER, ORDER_ID,
				OrderStatus.IN_PROGRESS.name(), OrderStatus.DELIVERED.name(), ESCORT_ID, null);
		verify(notificationService).createRouteLegCompleted(order.getCustomerId(), ORDER_ID, FIRST_LEG_ID);
		verify(notificationService, never()).createOrderDelivered(any(), any());
		verify(eventPublisher).publishEvent(new OrderDeliveredEvent(ORDER_ID,
				order.getCustomerId(), FIRST_LEG_ID, order.getDeliveredAt()));
	}

	@Test
	void finalReadinessIsCheckedOnlyAfterSharedOrderAndLegLocks() {
		firstLeg.start();
		ReflectionTestUtils.setField(order, "status", OrderStatus.IN_PROGRESS);
		prepare(FIRST_LEG_ID, List.of(firstLeg));

		boolean completed = coordinator.completeFinalLegWhenReady(FIRST_LEG_ID, () -> {
			verify(orderRepository).findByIdForUpdate(ORDER_ID);
			verify(routeLegRepository).findAllByRoutePlanIdForUpdate(PLAN_ID);
			return false;
		});

		assertThat(completed).isFalse();
		assertThat(firstLeg.getStatus()).isEqualTo(RouteLegStatus.IN_PROGRESS);
		assertThat(order.getStatus()).isEqualTo(OrderStatus.IN_PROGRESS);
		verifyNoInteractions(auditRecorder, eventPublisher);
	}

	@Test
	void synchronousDeliveryEventFailurePropagatesToTheTransactionCaller() {
		firstLeg.start();
		ReflectionTestUtils.setField(order, "status", OrderStatus.IN_PROGRESS);
		prepare(FIRST_LEG_ID, List.of(firstLeg));
		when(currentUserProvider.getCurrentUserId()).thenReturn(ESCORT_ID);
		when(userRepository.findByIdForUpdate(ESCORT_ID)).thenReturn(Optional.of(escort()));
		when(airExecutionRepository.findByRouteLegId(FIRST_LEG_ID))
				.thenReturn(Optional.of(new AirLegExecution(FIRST_LEG_ID, ESCORT_ID)));
		doThrow(new IllegalStateException("listener failed"))
				.when(eventPublisher).publishEvent(new OrderDeliveredEvent(
						ORDER_ID, order.getCustomerId(), FIRST_LEG_ID,
						LocalDateTime.of(2026, 10, 22, 10, 0)));

		assertThatThrownBy(() -> coordinator.completeFinalLegWhenReady(FIRST_LEG_ID, () -> true))
				.isInstanceOf(IllegalStateException.class)
				.hasMessage("listener failed");
	}

	@Test
	void notificationFailurePropagatesBeforeFinalDeliveryEventSoTheTransactionCanRollBack() {
		firstLeg.start();
		ReflectionTestUtils.setField(order, "status", OrderStatus.IN_PROGRESS);
		prepare(FIRST_LEG_ID, List.of(firstLeg));
		when(currentUserProvider.getCurrentUserId()).thenReturn(ESCORT_ID);
		when(userRepository.findByIdForUpdate(ESCORT_ID)).thenReturn(Optional.of(escort()));
		when(airExecutionRepository.findByRouteLegId(FIRST_LEG_ID))
				.thenReturn(Optional.of(new AirLegExecution(FIRST_LEG_ID, ESCORT_ID)));
		doThrow(new IllegalStateException("notification failed")).when(notificationService)
				.createRouteLegCompleted(order.getCustomerId(), ORDER_ID, FIRST_LEG_ID);

		assertThatThrownBy(() -> coordinator.completeFinalLegWhenReady(FIRST_LEG_ID, () -> true))
				.isInstanceOf(IllegalStateException.class)
				.hasMessage("notification failed");

		verify(eventPublisher, never()).publishEvent(any());
	}

	@Test
	void duplicateStartCannotCreateASecondTransition() {
		firstLeg.start();
		prepare(FIRST_LEG_ID, List.of(firstLeg, secondLeg));

		assertThatThrownBy(() -> coordinator.startCurrentLeg(FIRST_LEG_ID))
				.isInstanceOf(ExecutionConflictException.class)
				.hasMessageContaining("READY");
		verifyNoInteractions(auditRecorder);
		verifyNoInteractions(notificationService);
	}

	@Test
	void anotherRoadDriverCanStartTheirVehicleWhileLegIsAlreadyInProgress() {
		RouteLeg roadLeg = new RouteLeg(PLAN_ID, 1, RouteLegType.ROAD, "Origin", "Destination",
				LocalDateTime.now(), LocalDateTime.now().plusHours(2), null, null, null, null, null);
		ReflectionTestUtils.setField(roadLeg, "id", FIRST_LEG_ID);
		roadLeg.markReady();
		roadLeg.start();
		ReflectionTestUtils.setField(order, "status", OrderStatus.IN_PROGRESS);
		prepare(FIRST_LEG_ID, List.of(roadLeg, secondLeg));
		when(currentUserProvider.getCurrentUserId()).thenReturn(ESCORT_ID);
		when(userRepository.findByIdForUpdate(ESCORT_ID)).thenReturn(Optional.of(escort()));
		RoadLegVehicle vehicle = new RoadLegVehicle(FIRST_LEG_ID, UUID.randomUUID());
		when(roadLegVehicleRepository.findAllByRouteLegId(FIRST_LEG_ID)).thenReturn(List.of(vehicle));
		when(roadExecutionRepository.findAllByRoadLegVehicleIdIn(List.of(vehicle.getId())))
				.thenReturn(List.of(new RoadVehicleExecution(vehicle.getId(), UUID.randomUUID(), ESCORT_ID)));

		coordinator.startRoadVehicleExecution(FIRST_LEG_ID);

		assertThat(roadLeg.getStatus()).isEqualTo(RouteLegStatus.IN_PROGRESS);
		assertThat(order.getStatus()).isEqualTo(OrderStatus.IN_PROGRESS);
		verifyNoInteractions(auditRecorder);
		verifyNoInteractions(notificationService);
	}

	private void prepare(UUID requestedLegId, List<RouteLeg> legs) {
		RouteLeg requested = legs.stream().filter(leg -> leg.getId().equals(requestedLegId)).findFirst().orElseThrow();
		when(routeLegRepository.findById(requestedLegId)).thenReturn(Optional.of(requested));
		when(routePlanRepository.findById(PLAN_ID)).thenReturn(Optional.of(plan));
		when(orderRepository.findByIdForUpdate(ORDER_ID)).thenReturn(Optional.of(order));
		when(routeLegRepository.findAllByRoutePlanIdForUpdate(PLAN_ID)).thenReturn(legs);
	}

	private RouteLeg leg(UUID id, int sequence) {
		RouteLeg leg = new RouteLeg(PLAN_ID, sequence, RouteLegType.AIR, "A", "B",
				LocalDateTime.now(), LocalDateTime.now().plusHours(2), "Airline", "REF-1", 4, null, null);
		ReflectionTestUtils.setField(leg, "id", id);
		return leg;
	}

	private UserAccount escort() {
		UserAccount escort = UserAccount.createActive("Escort", "escort@test.local", null,
				"hash", UserRole.ESCORT);
		ReflectionTestUtils.setField(escort, "id", ESCORT_ID);
		return escort;
	}
}
