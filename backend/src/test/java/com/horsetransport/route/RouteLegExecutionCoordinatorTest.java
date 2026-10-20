package com.horsetransport.route;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.EntityManager;
import com.horsetransport.audit.AuditEntityType;
import com.horsetransport.audit.StatusAuditRecorder;
import com.horsetransport.order.OrderStatus;
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
	@Mock private EntityManager entityManager;

	private RoutePlan plan;
	private TransportOrder order;
	private RouteLeg firstLeg;
	private RouteLeg secondLeg;
	private RouteLegExecutionCoordinator coordinator;

	@BeforeEach
	void setUp() throws ReflectiveOperationException {
		coordinator = new RouteLegExecutionCoordinator(routeLegRepository, routePlanRepository,
				orderRepository, roadLegVehicleRepository, roadExecutionRepository,
				airExecutionRepository, userRepository, currentUserProvider, auditRecorder, entityManager);
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
	}

	@Test
	void rejectsStartingALaterLegBeforeItsPredecessorCompletes() {
		secondLeg.markReady();
		prepare(SECOND_LEG_ID, List.of(firstLeg, secondLeg));

		assertThatThrownBy(() -> coordinator.startCurrentLeg(SECOND_LEG_ID))
				.isInstanceOf(RoutePlanValidationException.class)
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
	}

	@Test
	void finalLegCannotUseTheNonFinalCompletionHook() {
		firstLeg.start();
		ReflectionTestUtils.setField(order, "status", OrderStatus.IN_PROGRESS);
		prepare(FIRST_LEG_ID, List.of(firstLeg));

		assertThatThrownBy(() -> coordinator.completeNonFinalLeg(FIRST_LEG_ID))
				.isInstanceOf(RoutePlanValidationException.class)
				.hasMessageContaining("PoD handover");
		assertThat(firstLeg.getStatus()).isEqualTo(RouteLegStatus.IN_PROGRESS);
		verifyNoInteractions(auditRecorder);
	}

	@Test
	void duplicateStartCannotCreateASecondTransition() {
		firstLeg.start();
		prepare(FIRST_LEG_ID, List.of(firstLeg, secondLeg));

		assertThatThrownBy(() -> coordinator.startCurrentLeg(FIRST_LEG_ID))
				.isInstanceOf(RoutePlanValidationException.class)
				.hasMessageContaining("READY");
		verifyNoInteractions(auditRecorder);
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
