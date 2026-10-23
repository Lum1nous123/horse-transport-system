package com.horsetransport.route;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.horsetransport.document.DocumentFileValidationException;
import com.horsetransport.document.DocumentStorage;
import com.horsetransport.notification.NotificationService;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import com.horsetransport.user.UserStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class AirJourneyServiceTest {

	private static final UUID PLAN_ID = UUID.randomUUID();
	private static final UUID ORDER_ID = UUID.randomUUID();
	private static final UUID LEG_ID = UUID.randomUUID();
	private static final UUID EXECUTION_ID = UUID.randomUUID();
	private static final UUID EVIDENCE_ID = UUID.randomUUID();
	private static final UUID ESCORT_ID = UUID.randomUUID();
	private static final UUID CUSTOMER_ID = UUID.randomUUID();
	private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 21, 9, 30);

	@Mock private AirLegExecutionRepository executionRepository;
	@Mock private RouteLegRepository routeLegRepository;
	@Mock private RoutePlanRepository routePlanRepository;
	@Mock private WelfareEvidenceRepository welfareRepository;
	@Mock private TransportOrderRepository orderRepository;
	@Mock private UserRepository userRepository;
	@Mock private CurrentUserProvider currentUserProvider;
	@Mock private RouteLegExecutionCoordinator coordinator;
	@Mock private NotificationService notificationService;
	@Mock private DocumentStorage storage;

	private AirJourneyService service;
	private RoutePlan plan;
	private RouteLeg leg;
	private AirLegExecution execution;

	@BeforeEach
	void setUp() {
		service = new AirJourneyService(executionRepository, routeLegRepository, routePlanRepository,
				welfareRepository, orderRepository, userRepository, currentUserProvider, coordinator,
				notificationService, storage,
				Clock.fixed(Instant.parse("2026-10-21T09:30:00Z"), ZoneOffset.UTC));
		plan = new RoutePlan(ORDER_ID, UUID.randomUUID());
		ReflectionTestUtils.setField(plan, "id", PLAN_ID);
		ReflectionTestUtils.setField(plan, "status", RoutePlanStatus.APPROVED);
		leg = new RouteLeg(PLAN_ID, 1, RouteLegType.AIR, "Origin", "Destination",
				NOW, NOW.plusHours(6), "Airline", "AIR-REF", 2, null, null);
		ReflectionTestUtils.setField(leg, "id", LEG_ID);
		leg.markReady();
		execution = new AirLegExecution(LEG_ID, ESCORT_ID);
		ReflectionTestUtils.setField(execution, "id", EXECUTION_ID);
		when(executionRepository.findByRouteLegIdForUpdate(LEG_ID)).thenReturn(Optional.of(execution));
		when(routeLegRepository.findById(LEG_ID)).thenReturn(Optional.of(leg));
		when(routePlanRepository.findById(PLAN_ID)).thenReturn(Optional.of(plan));
		TransportOrder order = org.mockito.Mockito.mock(TransportOrder.class);
		when(order.getId()).thenReturn(ORDER_ID);
		when(order.getCustomerId()).thenReturn(CUSTOMER_ID);
		when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));
	}

	@Test
	void assignedEscortStartsAirExecutionThroughCoordinator() {
		actAs(ESCORT_ID);
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.ESCORT);
		when(executionRepository.saveAndFlush(execution)).thenReturn(execution);

		AirExecutionResponse response = service.start(LEG_ID);

		assertThat(response.status()).isEqualTo(ExecutionStatus.IN_PROGRESS);
		assertThat(response.startedAt()).isEqualTo(NOW);
		verify(coordinator).startCurrentLeg(LEG_ID);
		verify(executionRepository).saveAndFlush(execution);
	}

	@Test
	void rejectsAnotherEscortBeforeStartingAirExecution() {
		UUID wrongEscortId = UUID.randomUUID();
		actAs(wrongEscortId);

		assertThatThrownBy(() -> service.start(LEG_ID))
				.isInstanceOf(AccessDeniedException.class)
				.hasMessage("Only the assigned Escort can perform this AIR action");

		assertThat(execution.getStatus()).isEqualTo(ExecutionStatus.NOT_STARTED);
		verify(coordinator, never()).startCurrentLeg(LEG_ID);
		verify(executionRepository, never()).saveAndFlush(execution);
	}

	@Test
	void rejectsInactiveAssignedEscortBeforeStartingAirExecution() {
		UserAccount inactiveEscort = UserAccount.createActive("Inactive Escort", "inactive@test.local",
				null, "hash", UserRole.ESCORT);
		ReflectionTestUtils.setField(inactiveEscort, "id", ESCORT_ID);
		ReflectionTestUtils.setField(inactiveEscort, "status", UserStatus.INACTIVE);
		when(currentUserProvider.getCurrentUserId()).thenReturn(ESCORT_ID);
		when(userRepository.findByIdForUpdate(ESCORT_ID)).thenReturn(Optional.of(inactiveEscort));

		assertThatThrownBy(() -> service.start(LEG_ID))
				.isInstanceOf(AccessDeniedException.class)
				.hasMessage("Only an assigned active Escort can perform this AIR action");

		verify(coordinator, never()).startCurrentLeg(LEG_ID);
		verify(executionRepository, never()).saveAndFlush(execution);
	}

	@Test
	void startRetryReturnsPersistedExecutionWithoutStartingLegAgain() {
		execution.start(NOW);
		actAs(ESCORT_ID);
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.ESCORT);

		AirExecutionResponse response = service.start(LEG_ID);

		assertThat(response.status()).isEqualTo(ExecutionStatus.IN_PROGRESS);
		assertThat(response.startedAt()).isEqualTo(NOW);
		verify(coordinator, never()).startCurrentLeg(LEG_ID);
		verify(executionRepository, never()).saveAndFlush(execution);
	}

	@Test
	void assignedEscortRecordsDestinationArrival() {
		leg.start();
		execution.start(NOW.minusHours(6));
		actAs(ESCORT_ID);
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.ESCORT);
		when(executionRepository.saveAndFlush(execution)).thenReturn(execution);

		AirExecutionResponse response = service.arriveAtDestination(LEG_ID);

		assertThat(response.status()).isEqualTo(ExecutionStatus.DESTINATION);
		assertThat(response.destinationArrivedAt()).isEqualTo(NOW);
		verify(executionRepository).saveAndFlush(execution);
		verify(notificationService).createAirFinalDestinationReached(CUSTOMER_ID, ORDER_ID, EXECUTION_ID);
	}

	@Test
	void destinationRetryReturnsPersistedExecutionWithoutChangingItAgain() {
		leg.start();
		execution.start(NOW.minusHours(6));
		execution.arriveAtDestination(NOW.minusMinutes(5));
		actAs(ESCORT_ID);
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.ESCORT);

		AirExecutionResponse response = service.arriveAtDestination(LEG_ID);

		assertThat(response.status()).isEqualTo(ExecutionStatus.DESTINATION);
		assertThat(response.destinationArrivedAt()).isEqualTo(NOW.minusMinutes(5));
		verify(executionRepository, never()).saveAndFlush(execution);
		verify(notificationService, never()).createAirFinalDestinationReached(any(), any(), any());
	}

	@Test
	void rejectsDestinationArrivalWhileRouteLegIsNotInProgress() {
		execution.start(NOW.minusHours(6));
		actAs(ESCORT_ID);
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.ESCORT);

		assertThatThrownBy(() -> service.arriveAtDestination(LEG_ID))
				.isInstanceOf(RoutePlanValidationException.class)
				.hasMessage("AIR RouteLeg is not in progress");

		assertThat(execution.getStatus()).isEqualTo(ExecutionStatus.IN_PROGRESS);
		verify(executionRepository, never()).saveAndFlush(execution);
	}

	@Test
	void nonFinalAirCompletesAfterDestinationAndWelfareThenOpensNextLeg() {
		prepareDestinationArrival();
		actAs(ESCORT_ID);
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.ESCORT);
		when(welfareRepository.findByAirLegExecutionIdAndEventType(
				EXECUTION_ID, WelfareEventType.FINAL_DESTINATION)).thenReturn(Optional.empty());
		when(storage.upload(any(byte[].class), any(String.class), any(String.class), anyBoolean()))
				.thenReturn("https://storage.example/air-welfare.jpg");
		when(welfareRepository.saveAndFlush(any(WelfareEvidence.class)))
				.thenAnswer(invocation -> persistedEvidence(invocation.getArgument(0)));
		when(executionRepository.saveAndFlush(execution)).thenReturn(execution);
		RouteLeg nextLeg = new RouteLeg(PLAN_ID, 2, RouteLegType.ROAD, "Destination", "Final",
				NOW.plusHours(2), NOW.plusHours(5), null, null, null, "Truck", null);
		when(routeLegRepository.findAllByRoutePlanIdOrderBySequenceNoAsc(PLAN_ID))
				.thenReturn(List.of(leg, nextLeg));

		WelfareEvidenceResponse response = service.recordFinalWelfare(
				LEG_ID, validJpeg(), "  Horse is well  ");

		assertThat(response.eventType()).isEqualTo(WelfareEventType.FINAL_DESTINATION);
		assertThat(response.airLegExecutionId()).isEqualTo(EXECUTION_ID);
		assertThat(response.note()).isEqualTo("Horse is well");
		assertThat(execution.getStatus()).isEqualTo(ExecutionStatus.COMPLETED);
		assertThat(execution.getCompletedAt()).isEqualTo(NOW);
		verify(notificationService).createWelfareUpdated(CUSTOMER_ID, ORDER_ID, EVIDENCE_ID);
		verify(coordinator).completeNonFinalLeg(LEG_ID);
	}

	@Test
	void finalAirStopsAtPodBoundaryAfterDestinationAndWelfare() {
		prepareDestinationArrival();
		actAs(ESCORT_ID);
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.ESCORT);
		when(welfareRepository.findByAirLegExecutionIdAndEventType(
				EXECUTION_ID, WelfareEventType.FINAL_DESTINATION)).thenReturn(Optional.empty());
		when(storage.upload(any(byte[].class), any(String.class), any(String.class), anyBoolean()))
				.thenReturn("https://storage.example/air-welfare.jpg");
		when(welfareRepository.saveAndFlush(any(WelfareEvidence.class)))
				.thenAnswer(invocation -> persistedEvidence(invocation.getArgument(0)));
		when(routeLegRepository.findAllByRoutePlanIdOrderBySequenceNoAsc(PLAN_ID))
				.thenReturn(List.of(leg));

		WelfareEvidenceResponse response = service.recordFinalWelfare(
				LEG_ID, validJpeg(), "Horse is ready for handover");

		assertThat(response.eventType()).isEqualTo(WelfareEventType.FINAL_DESTINATION);
		assertThat(execution.getStatus()).isEqualTo(ExecutionStatus.DESTINATION);
		assertThat(leg.getStatus()).isEqualTo(RouteLegStatus.IN_PROGRESS);
		verify(notificationService).createWelfareUpdated(CUSTOMER_ID, ORDER_ID, EVIDENCE_ID);
		verify(executionRepository, never()).saveAndFlush(execution);
		verify(coordinator, never()).completeNonFinalLeg(LEG_ID);
	}

	@Test
	void welfareRetryReturnsPersistedEvidenceWithoutUploadingOrCompletingAgain() {
		prepareDestinationArrival();
		actAs(ESCORT_ID);
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.ESCORT);
		WelfareEvidence existing = new WelfareEvidence(EXECUTION_ID,
				WelfareEventType.FINAL_DESTINATION, "https://storage.example/existing.jpg",
				"Already recorded", ESCORT_ID, NOW.minusMinutes(1));
		when(welfareRepository.findByAirLegExecutionIdAndEventType(
				EXECUTION_ID, WelfareEventType.FINAL_DESTINATION)).thenReturn(Optional.of(existing));

		WelfareEvidenceResponse response = service.recordFinalWelfare(
				LEG_ID, validJpeg(), "Duplicate request");

		assertThat(response.photoUrl()).isEqualTo("https://storage.example/existing.jpg");
		verify(notificationService, never()).createWelfareUpdated(any(), any(), any());
		verify(storage, never()).upload(any(byte[].class), any(String.class), any(String.class), anyBoolean());
		verify(coordinator, never()).completeNonFinalLeg(LEG_ID);
	}

	@Test
	void rejectsWelfareBeforeDestinationArrival() {
		leg.start();
		execution.start(NOW.minusHours(2));
		actAs(ESCORT_ID);
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.ESCORT);
		when(welfareRepository.findByAirLegExecutionIdAndEventType(
				EXECUTION_ID, WelfareEventType.FINAL_DESTINATION)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.recordFinalWelfare(LEG_ID, validJpeg(), "Horse is well"))
				.isInstanceOf(RoutePlanValidationException.class)
				.hasMessageContaining("destination arrival");

		verify(storage, never()).upload(any(byte[].class), any(String.class), any(String.class), anyBoolean());
	}

	@Test
	void rejectsMissingWelfarePhotoWithoutCompletingAir() {
		prepareDestinationArrival();
		actAs(ESCORT_ID);
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.ESCORT);
		when(welfareRepository.findByAirLegExecutionIdAndEventType(
				EXECUTION_ID, WelfareEventType.FINAL_DESTINATION)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.recordFinalWelfare(LEG_ID, null, "Horse is well"))
				.isInstanceOf(DocumentFileValidationException.class)
				.hasMessageContaining("welfare photo");

		assertThat(execution.getStatus()).isEqualTo(ExecutionStatus.DESTINATION);
		verify(coordinator, never()).completeNonFinalLeg(LEG_ID);
	}

	@Test
	void rejectsMissingWelfareNoteWithoutCompletingAir() {
		prepareDestinationArrival();
		actAs(ESCORT_ID);
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.ESCORT);
		when(welfareRepository.findByAirLegExecutionIdAndEventType(
				EXECUTION_ID, WelfareEventType.FINAL_DESTINATION)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.recordFinalWelfare(LEG_ID, validJpeg(), "  "))
				.isInstanceOf(RoutePlanValidationException.class)
				.hasMessageContaining("welfare note");

		assertThat(execution.getStatus()).isEqualTo(ExecutionStatus.DESTINATION);
		verify(coordinator, never()).completeNonFinalLeg(LEG_ID);
	}

	@Test
	void rejectsWelfareFromAnotherEscort() {
		prepareDestinationArrival();
		UUID wrongEscortId = UUID.randomUUID();
		actAs(wrongEscortId);

		assertThatThrownBy(() -> service.recordFinalWelfare(
				LEG_ID, validJpeg(), "Horse is well"))
				.isInstanceOf(AccessDeniedException.class);

		verify(storage, never()).upload(any(byte[].class), any(String.class), any(String.class), anyBoolean());
	}

	private void prepareDestinationArrival() {
		leg.start();
		execution.start(NOW.minusHours(6));
		execution.arriveAtDestination(NOW.minusMinutes(10));
	}

	private WelfareEvidence persistedEvidence(WelfareEvidence evidence) {
		ReflectionTestUtils.setField(evidence, "id", EVIDENCE_ID);
		return evidence;
	}

	private MockMultipartFile validJpeg() {
		return new MockMultipartFile("photo", "welfare.jpg", "image/jpeg",
				new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff, 0x00});
	}

	private void actAs(UUID actorId) {
		UserAccount account = UserAccount.createActive("Air Escort", "air@test.local", null,
				"hash", UserRole.ESCORT);
		ReflectionTestUtils.setField(account, "id", actorId);
		when(currentUserProvider.getCurrentUserId()).thenReturn(actorId);
		when(userRepository.findByIdForUpdate(actorId)).thenReturn(Optional.of(account));
	}
}
