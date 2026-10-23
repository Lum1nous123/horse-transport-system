package com.horsetransport.route;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.anyBoolean;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.BooleanSupplier;

import com.horsetransport.document.DocumentStorage;
import com.horsetransport.notification.NotificationService;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class RoadJourneyServiceTest {

	private static final UUID PLAN_ID = UUID.randomUUID();
	private static final UUID ORDER_ID = UUID.randomUUID();
	private static final UUID LEG_ID = UUID.randomUUID();
	private static final UUID VEHICLE_LINK_ID = UUID.randomUUID();
	private static final UUID EXECUTION_ID = UUID.randomUUID();
	private static final UUID CHECKPOINT_ID = UUID.randomUUID();
	private static final UUID DRIVER_ID = UUID.randomUUID();
	private static final UUID ESCORT_ID = UUID.randomUUID();
	private static final UUID CUSTOMER_ID = UUID.randomUUID();
	private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 20, 3, 0);

	@Mock private RoadLegVehicleRepository roadVehicleRepository;
	@Mock private RoadVehicleExecutionRepository executionRepository;
	@Mock private RouteLegRepository routeLegRepository;
	@Mock private RoutePlanRepository routePlanRepository;
	@Mock private CheckpointRepository checkpointRepository;
	@Mock private VehicleCheckpointArrivalRepository arrivalRepository;
	@Mock private WelfareEvidenceRepository welfareRepository;
	@Mock private TransportOrderRepository orderRepository;
	@Mock private UserRepository userRepository;
	@Mock private CurrentUserProvider currentUserProvider;
	@Mock private RouteLegExecutionCoordinator coordinator;
	@Mock private NotificationService notificationService;
	@Mock private DocumentStorage storage;

	private RoadJourneyService service;
	private RoutePlan plan;
	private RouteLeg leg;
	private RoadLegVehicle roadVehicle;
	private RoadVehicleExecution execution;
	private Checkpoint checkpoint;

	@BeforeEach
	void setUp() {
		service = new RoadJourneyService(roadVehicleRepository, executionRepository, routeLegRepository,
				routePlanRepository, checkpointRepository, arrivalRepository, welfareRepository,
				orderRepository, userRepository, currentUserProvider, coordinator, notificationService, storage,
				Clock.fixed(Instant.parse("2026-10-20T03:00:00Z"), ZoneOffset.UTC));
		plan = new RoutePlan(ORDER_ID, UUID.randomUUID());
		ReflectionTestUtils.setField(plan, "id", PLAN_ID);
		ReflectionTestUtils.setField(plan, "status", RoutePlanStatus.APPROVED);
		leg = new RouteLeg(PLAN_ID, 1, RouteLegType.ROAD, "Origin", "Destination",
				NOW, NOW.plusHours(2), null, null, null, null, null);
		ReflectionTestUtils.setField(leg, "id", LEG_ID);
		leg.markReady();
		leg.start();
		roadVehicle = new RoadLegVehicle(LEG_ID, UUID.randomUUID());
		ReflectionTestUtils.setField(roadVehicle, "id", VEHICLE_LINK_ID);
		execution = new RoadVehicleExecution(VEHICLE_LINK_ID, DRIVER_ID, ESCORT_ID);
		ReflectionTestUtils.setField(execution, "id", EXECUTION_ID);
		execution.start(NOW);
		checkpoint = new Checkpoint(LEG_ID, 1, "Border", CheckpointType.BORDER, "VN", null, null, null);
		ReflectionTestUtils.setField(checkpoint, "id", CHECKPOINT_ID);
		when(roadVehicleRepository.findById(VEHICLE_LINK_ID)).thenReturn(Optional.of(roadVehicle));
		when(executionRepository.findByRoadLegVehicleIdForUpdate(VEHICLE_LINK_ID))
				.thenReturn(Optional.of(execution));
		when(routeLegRepository.findById(LEG_ID)).thenReturn(Optional.of(leg));
		when(routePlanRepository.findById(PLAN_ID)).thenReturn(Optional.of(plan));
		TransportOrder order = org.mockito.Mockito.mock(TransportOrder.class);
		when(order.getId()).thenReturn(ORDER_ID);
		when(order.getCustomerId()).thenReturn(CUSTOMER_ID);
		when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));
	}

	@Test
	void driverStartsOnlyTheirVehicleExecutionThroughSharedCoordinator() {
		actAs(DRIVER_ID, UserRole.DRIVER);
		execution = new RoadVehicleExecution(VEHICLE_LINK_ID, DRIVER_ID, ESCORT_ID);
		ReflectionTestUtils.setField(execution, "id", EXECUTION_ID);
		when(executionRepository.findByRoadLegVehicleIdForUpdate(VEHICLE_LINK_ID))
				.thenReturn(Optional.of(execution));
		when(executionRepository.saveAndFlush(execution)).thenReturn(execution);

		RoadExecutionResponse response = service.start(VEHICLE_LINK_ID);

		assertThat(response.status()).isEqualTo(ExecutionStatus.IN_PROGRESS);
		assertThat(response.startedAt()).isEqualTo(NOW);
		verify(coordinator).startRoadVehicleExecution(LEG_ID);
	}

	@Test
	void recordsCheckpointArrivalAgainstSharedLegForThisVehicleExecution() {
		actAs(DRIVER_ID, UserRole.DRIVER);
		when(checkpointRepository.findById(CHECKPOINT_ID)).thenReturn(Optional.of(checkpoint));
		when(checkpointRepository.findAllByRouteLegIdOrderBySequenceNoAsc(LEG_ID))
				.thenReturn(List.of(checkpoint));
		when(arrivalRepository.findByRoadVehicleExecutionIdAndCheckpointId(EXECUTION_ID, CHECKPOINT_ID))
				.thenReturn(Optional.empty());
		when(arrivalRepository.findAllByRoadVehicleExecutionId(EXECUTION_ID)).thenReturn(List.of());
		when(arrivalRepository.saveAndFlush(any(VehicleCheckpointArrival.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		CheckpointArrivalResponse response = service.arriveAtCheckpoint(VEHICLE_LINK_ID, CHECKPOINT_ID);

		assertThat(response.executionId()).isEqualTo(EXECUTION_ID);
		assertThat(response.checkpointId()).isEqualTo(CHECKPOINT_ID);
		assertThat(response.recordedByDriverId()).isEqualTo(DRIVER_ID);
		assertThat(response.arrivedAt()).isEqualTo(NOW);
		verify(notificationService).createCheckpointReached(CUSTOMER_ID, ORDER_ID, response.id());

		UUID secondVehicleId = UUID.randomUUID();
		UUID secondExecutionId = UUID.randomUUID();
		UUID secondDriverId = UUID.randomUUID();
		RoadLegVehicle secondVehicle = new RoadLegVehicle(LEG_ID, UUID.randomUUID());
		ReflectionTestUtils.setField(secondVehicle, "id", secondVehicleId);
		RoadVehicleExecution secondExecution = new RoadVehicleExecution(secondVehicleId, secondDriverId,
				UUID.randomUUID());
		ReflectionTestUtils.setField(secondExecution, "id", secondExecutionId);
		secondExecution.start(NOW);
		when(roadVehicleRepository.findById(secondVehicleId)).thenReturn(Optional.of(secondVehicle));
		when(executionRepository.findByRoadLegVehicleIdForUpdate(secondVehicleId))
				.thenReturn(Optional.of(secondExecution));
		when(userRepository.findByIdForUpdate(secondDriverId))
				.thenReturn(Optional.of(activeUser(UserRole.DRIVER, secondDriverId)));
		when(arrivalRepository.findByRoadVehicleExecutionIdAndCheckpointId(secondExecutionId, CHECKPOINT_ID))
				.thenReturn(Optional.empty());
		when(arrivalRepository.findAllByRoadVehicleExecutionId(secondExecutionId)).thenReturn(List.of());
		when(currentUserProvider.getCurrentUserId()).thenReturn(secondDriverId);
		CheckpointArrivalResponse secondArrival = service.arriveAtCheckpoint(secondVehicleId, CHECKPOINT_ID);
		assertThat(secondArrival.executionId()).isEqualTo(secondExecutionId);
		assertThat(secondArrival.checkpointId()).isEqualTo(response.checkpointId());
		verify(notificationService).createCheckpointReached(CUSTOMER_ID, ORDER_ID, secondArrival.id());
	}

	@Test
	void checkpointRetryReturnsPersistedArrivalWithoutCreatingAnotherNotification() {
		actAs(DRIVER_ID, UserRole.DRIVER);
		VehicleCheckpointArrival existing = new VehicleCheckpointArrival(
				EXECUTION_ID, CHECKPOINT_ID, DRIVER_ID, NOW.minusMinutes(1));
		when(arrivalRepository.findByRoadVehicleExecutionIdAndCheckpointId(EXECUTION_ID, CHECKPOINT_ID))
				.thenReturn(Optional.of(existing));

		CheckpointArrivalResponse response = service.arriveAtCheckpoint(VEHICLE_LINK_ID, CHECKPOINT_ID);

		assertThat(response.id()).isEqualTo(existing.getId());
		verify(notificationService, never()).createCheckpointReached(any(), any(), any());
		verify(arrivalRepository, never()).saveAndFlush(any());
	}

	@Test
	void rejectsCheckpointArrivalByAnotherDriver() {
		UUID wrongDriver = UUID.randomUUID();
		when(currentUserProvider.getCurrentUserId()).thenReturn(wrongDriver);
		when(userRepository.findByIdForUpdate(wrongDriver))
				.thenReturn(Optional.of(activeUser(UserRole.DRIVER, wrongDriver)));

		assertThatThrownBy(() -> service.arriveAtCheckpoint(VEHICLE_LINK_ID, CHECKPOINT_ID))
				.isInstanceOf(AccessDeniedException.class);
	}

	@Test
	void rejectsWelfareAtACheckpointThisVehicleHasNotReached() {
		actAs(ESCORT_ID, UserRole.ESCORT);
		when(welfareRepository.findByRoadVehicleExecutionIdAndCheckpointIdAndEventType(
				EXECUTION_ID, CHECKPOINT_ID, WelfareEventType.CHECKPOINT)).thenReturn(Optional.empty());
		when(checkpointRepository.findById(CHECKPOINT_ID)).thenReturn(Optional.of(checkpoint));
		when(arrivalRepository.findByRoadVehicleExecutionIdAndCheckpointId(EXECUTION_ID, CHECKPOINT_ID))
				.thenReturn(Optional.empty());
		MockMultipartFile photo = new MockMultipartFile("photo", "welfare.jpg", "image/jpeg",
				new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff});

		assertThatThrownBy(() -> service.recordCheckpointWelfare(VEHICLE_LINK_ID, CHECKPOINT_ID,
				photo, "Horse is well"))
				.isInstanceOf(RoutePlanValidationException.class)
				.hasMessageContaining("reached its checkpoint");
	}

	@Test
	void rejectsWelfareFromAnotherEscort() {
		UUID wrongEscort = UUID.randomUUID();
		when(currentUserProvider.getCurrentUserId()).thenReturn(wrongEscort);
		when(userRepository.findByIdForUpdate(wrongEscort))
				.thenReturn(Optional.of(activeUser(UserRole.ESCORT, wrongEscort)));
		MockMultipartFile photo = new MockMultipartFile("photo", "welfare.jpg", "image/jpeg",
				new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff});

		assertThatThrownBy(() -> service.recordFinalWelfare(VEHICLE_LINK_ID, photo, "Horse is well"))
				.isInstanceOf(AccessDeniedException.class);
	}

	@Test
	void destinationCanBeRecordedWithoutCreatingFakeArrivalForAnUnreachedCheckpoint() {
		actAs(DRIVER_ID, UserRole.DRIVER);

		RoadExecutionResponse response = service.arriveAtDestination(VEHICLE_LINK_ID);

		assertThat(response.status()).isEqualTo(ExecutionStatus.DESTINATION);
		assertThat(execution.getStatus()).isEqualTo(ExecutionStatus.DESTINATION);
		assertThat(response.destinationArrivedAt()).isEqualTo(NOW);
		verify(arrivalRepository).findAllByRoadVehicleExecutionId(EXECUTION_ID);
		verify(arrivalRepository, never()).saveAndFlush(any(VehicleCheckpointArrival.class));
		verify(notificationService).createRoadFinalDestinationReached(CUSTOMER_ID, ORDER_ID, EXECUTION_ID);
	}

	@Test
	void reachedCheckpointRequiresEscortWelfareBeforeVehicleProgressesToDestination() {
		actAs(DRIVER_ID, UserRole.DRIVER);
		VehicleCheckpointArrival arrival = new VehicleCheckpointArrival(EXECUTION_ID,
				CHECKPOINT_ID, DRIVER_ID, NOW);
		when(arrivalRepository.findAllByRoadVehicleExecutionId(EXECUTION_ID)).thenReturn(List.of(arrival));
		when(checkpointRepository.findAllByRouteLegIdOrderBySequenceNoAsc(LEG_ID))
				.thenReturn(List.of(checkpoint));
		when(welfareRepository.findByRoadVehicleExecutionIdAndCheckpointIdAndEventType(
				EXECUTION_ID, CHECKPOINT_ID, WelfareEventType.CHECKPOINT)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.arriveAtDestination(VEHICLE_LINK_ID))
				.isInstanceOf(RoutePlanValidationException.class)
				.hasMessageContaining("welfare photo and note");
		assertThat(execution.getStatus()).isEqualTo(ExecutionStatus.IN_PROGRESS);
	}

	@Test
	void vehicleCompletesAfterDestinationAndFinalWelfareThenChecksLegAggregation() {
		execution.arriveAtDestination(NOW);
		actAs(ESCORT_ID, UserRole.ESCORT);
		when(welfareRepository.findByRoadVehicleExecutionIdAndEventType(
				EXECUTION_ID, WelfareEventType.FINAL_DESTINATION)).thenReturn(Optional.empty(),
					Optional.of(new WelfareEvidence(EXECUTION_ID, null, WelfareEventType.FINAL_DESTINATION,
							"https://storage.example/welfare.jpg", "Horse is well", ESCORT_ID, NOW)));
		when(storage.upload(any(byte[].class), any(String.class), any(String.class), anyBoolean()))
				.thenReturn("https://storage.example/welfare.jpg");
		when(welfareRepository.saveAndFlush(any(WelfareEvidence.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));
		RouteLeg nextLeg = new RouteLeg(PLAN_ID, 2, RouteLegType.AIR, "Destination", "Final",
				NOW.plusHours(3), NOW.plusHours(5), "Airline", "REF", 2, null, null);
		when(routeLegRepository.findAllByRoutePlanIdOrderBySequenceNoAsc(PLAN_ID))
				.thenReturn(List.of(leg, nextLeg));
		RoadLegVehicle secondRoadVehicle = new RoadLegVehicle(LEG_ID, UUID.randomUUID());
		RoadVehicleExecution secondExecution = new RoadVehicleExecution(secondRoadVehicle.getId(),
				UUID.randomUUID(), UUID.randomUUID());
		secondExecution.start(NOW);
		secondExecution.arriveAtDestination(NOW.plusHours(1));
		secondExecution.complete(NOW.plusHours(1));
		when(roadVehicleRepository.findAllByRouteLegId(LEG_ID))
				.thenReturn(List.of(roadVehicle, secondRoadVehicle));
		when(executionRepository.findAllByRoadLegVehicleIdIn(
				List.of(VEHICLE_LINK_ID, secondRoadVehicle.getId())))
				.thenReturn(List.of(execution, secondExecution));
		AtomicBoolean ready = new AtomicBoolean(true);
		org.mockito.Mockito.doAnswer(invocation -> {
			ready.set(((BooleanSupplier) invocation.getArgument(1)).getAsBoolean());
			return ready.get();
		}).when(coordinator).completeNonFinalLegWhenReady(any(), any());
		MockMultipartFile photo = new MockMultipartFile("photo", "welfare.jpg", "image/jpeg",
				new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff, 0x00});

		WelfareEvidenceResponse response = service.recordFinalWelfare(VEHICLE_LINK_ID, photo, "Horse is well");

		assertThat(response.eventType()).isEqualTo(WelfareEventType.FINAL_DESTINATION);
		assertThat(response.recordedByEscortId()).isEqualTo(ESCORT_ID);
		assertThat(execution.getStatus()).isEqualTo(ExecutionStatus.COMPLETED);
		assertThat(ready).isTrue();
		verify(notificationService).createWelfareUpdated(CUSTOMER_ID, ORDER_ID, response.id());
		verify(coordinator).completeNonFinalLegWhenReady(any(), any());
	}

	@Test
	void roadWelfareRetryReturnsPersistedEvidenceWithoutCreatingAnotherNotification() {
		execution.arriveAtDestination(NOW.minusMinutes(2));
		actAs(ESCORT_ID, UserRole.ESCORT);
		WelfareEvidence existing = new WelfareEvidence(EXECUTION_ID, null,
				WelfareEventType.FINAL_DESTINATION, "https://storage.example/existing.jpg",
				"Already recorded", ESCORT_ID, NOW.minusMinutes(1));
		when(welfareRepository.findByRoadVehicleExecutionIdAndEventType(
				EXECUTION_ID, WelfareEventType.FINAL_DESTINATION)).thenReturn(Optional.of(existing));

		WelfareEvidenceResponse response = service.recordFinalWelfare(VEHICLE_LINK_ID,
				new MockMultipartFile("photo", new byte[0]), "Duplicate");

		assertThat(response.id()).isEqualTo(existing.getId());
		verify(notificationService, never()).createWelfareUpdated(any(), any(), any());
		verify(storage, never()).upload(any(), any(), any(), anyBoolean());
	}

	private void actAs(UUID actorId, UserRole role) {
		UserAccount account = activeUser(role, actorId);
		when(currentUserProvider.getCurrentUserId()).thenReturn(actorId);
		when(currentUserProvider.getCurrentUserRole()).thenReturn(role);
		when(userRepository.findByIdForUpdate(actorId)).thenReturn(Optional.of(account));
	}

	private UserAccount activeUser(UserRole role, UUID actorId) {
		UserAccount account = UserAccount.createActive("Execution User", "road@test.local", null, "hash", role);
		ReflectionTestUtils.setField(account, "id", actorId);
		return account;
	}
}
