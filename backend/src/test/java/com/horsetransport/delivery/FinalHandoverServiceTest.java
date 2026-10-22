package com.horsetransport.delivery;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BooleanSupplier;

import com.horsetransport.document.DocumentStorage;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.route.AirLegExecution;
import com.horsetransport.route.AirLegExecutionRepository;
import com.horsetransport.route.ExecutionStatus;
import com.horsetransport.route.RoadLegVehicle;
import com.horsetransport.route.RoadLegVehicleHorse;
import com.horsetransport.route.RoadLegVehicleHorseRepository;
import com.horsetransport.route.RoadLegVehicleRepository;
import com.horsetransport.route.RoadVehicleExecution;
import com.horsetransport.route.RoadVehicleExecutionRepository;
import com.horsetransport.route.RouteLeg;
import com.horsetransport.route.RouteLegExecutionCoordinator;
import com.horsetransport.route.RouteLegRepository;
import com.horsetransport.route.RouteLegStatus;
import com.horsetransport.route.RouteLegType;
import com.horsetransport.route.RoutePlan;
import com.horsetransport.route.RoutePlanRepository;
import com.horsetransport.route.RoutePlanStatus;
import com.horsetransport.route.RoutePlanValidationException;
import com.horsetransport.route.WelfareEventType;
import com.horsetransport.route.WelfareEvidence;
import com.horsetransport.route.WelfareEvidenceRepository;
import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class FinalHandoverServiceTest {

	private static final UUID ORDER_ID = UUID.randomUUID();
	private static final UUID PLAN_ID = UUID.randomUUID();
	private static final UUID LEG_ID = UUID.randomUUID();
	private static final UUID ROAD_VEHICLE_ID = UUID.randomUUID();
	private static final UUID ROAD_EXECUTION_ID = UUID.randomUUID();
	private static final UUID AIR_EXECUTION_ID = UUID.randomUUID();
	private static final UUID ESCORT_ID = UUID.randomUUID();
	private static final UUID ORDER_HORSE_ID = UUID.randomUUID();
	private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 22, 10, 0);

	@Mock private ProofOfDeliveryRepository proofRepository;
	@Mock private RoadLegVehicleRepository roadVehicleRepository;
	@Mock private RoadLegVehicleHorseRepository roadHorseRepository;
	@Mock private RoadVehicleExecutionRepository roadExecutionRepository;
	@Mock private AirLegExecutionRepository airExecutionRepository;
	@Mock private RouteLegRepository routeLegRepository;
	@Mock private RoutePlanRepository routePlanRepository;
	@Mock private TransportOrderRepository orderRepository;
	@Mock private WelfareEvidenceRepository welfareRepository;
	@Mock private UserRepository userRepository;
	@Mock private CurrentUserProvider currentUserProvider;
	@Mock private RouteLegExecutionCoordinator coordinator;
	@Mock private DocumentStorage storage;

	private FinalHandoverService service;
	private RoutePlan plan;
	private TransportOrder order;

	@BeforeEach
	void setUp() throws ReflectiveOperationException {
		service = new FinalHandoverService(proofRepository, roadVehicleRepository,
				roadHorseRepository, roadExecutionRepository, airExecutionRepository,
				routeLegRepository, routePlanRepository, orderRepository, welfareRepository,
				userRepository, currentUserProvider, coordinator, storage,
				Clock.fixed(Instant.parse("2026-10-22T10:00:00Z"), ZoneOffset.UTC));
		plan = new RoutePlan(ORDER_ID, UUID.randomUUID());
		ReflectionTestUtils.setField(plan, "id", PLAN_ID);
		ReflectionTestUtils.setField(plan, "status", RoutePlanStatus.APPROVED);
		var constructor = TransportOrder.class.getDeclaredConstructor(UUID.class, String.class);
		constructor.setAccessible(true);
		order = constructor.newInstance(UUID.randomUUID(), "HT-POD");
		ReflectionTestUtils.setField(order, "id", ORDER_ID);
		ReflectionTestUtils.setField(order, "status", OrderStatus.IN_PROGRESS);
		when(routePlanRepository.findById(PLAN_ID)).thenReturn(Optional.of(plan));
		when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));
	}

	@Test
	void roadConsumesBe24CompletedExecutionAndWaitsForEveryVehiclePod() {
		RoadFixture fixture = prepareRoad(ExecutionStatus.COMPLETED);
		RoadLegVehicle secondVehicle = new RoadLegVehicle(LEG_ID, UUID.randomUUID());
		RoadVehicleExecution secondExecution = completedRoadExecution(secondVehicle.getId(), UUID.randomUUID());
		when(roadVehicleRepository.findAllByRouteLegId(LEG_ID))
				.thenReturn(List.of(fixture.roadVehicle(), secondVehicle));
		when(roadExecutionRepository.findAllByRoadLegVehicleIdIn(any()))
				.thenReturn(List.of(fixture.execution(), secondExecution));
		AtomicReference<ProofOfDelivery> saved = saveRoadProof();
		when(proofRepository.findAllByRoadVehicleExecutionIdIn(any())).thenAnswer(invocation ->
				saved.get() == null ? List.of() : List.of(saved.get()));
		when(storage.upload(any(byte[].class), anyString(), anyString(), anyBoolean()))
				.thenReturn("https://storage.example/road-pod.jpg");
		AtomicReference<Boolean> ready = new AtomicReference<>();
		org.mockito.Mockito.doAnswer(invocation -> {
			ready.set(((BooleanSupplier) invocation.getArgument(1)).getAsBoolean());
			return ready.get();
		}).when(coordinator).completeFinalLegWhenReady(any(), any());

		ProofOfDeliveryResponse response = service.recordRoadHandover(
				ROAD_VEHICLE_ID, "Recipient", validJpeg(), "Safe handover");

		assertThat(response.completedHandovers()).isEqualTo(1);
		assertThat(response.requiredHandovers()).isEqualTo(2);
		assertThat(response.transportedOrderHorseIds()).containsExactly(ORDER_HORSE_ID);
		assertThat(ready.get()).isFalse();
	}

	@Test
	void lastRoadVehiclePodMakesFinalCoordinatorReadinessTrue() {
		RoadFixture fixture = prepareRoad(ExecutionStatus.COMPLETED);
		when(roadVehicleRepository.findAllByRouteLegId(LEG_ID)).thenReturn(List.of(fixture.roadVehicle()));
		when(roadExecutionRepository.findAllByRoadLegVehicleIdIn(any())).thenReturn(List.of(fixture.execution()));
		AtomicReference<ProofOfDelivery> saved = saveRoadProof();
		when(proofRepository.findAllByRoadVehicleExecutionIdIn(any())).thenAnswer(invocation ->
				saved.get() == null ? List.of() : List.of(saved.get()));
		when(storage.upload(any(byte[].class), anyString(), anyString(), anyBoolean()))
				.thenReturn("https://storage.example/last-road-pod.jpg");
		AtomicReference<Boolean> ready = new AtomicReference<>();
		org.mockito.Mockito.doAnswer(invocation -> {
			ready.set(((BooleanSupplier) invocation.getArgument(1)).getAsBoolean());
			return ready.get();
		}).when(coordinator).completeFinalLegWhenReady(any(), any());

		service.recordRoadHandover(ROAD_VEHICLE_ID, "Recipient", validJpeg(), null);

		assertThat(ready.get()).isTrue();
	}

	@Test
	void roadRejectsHandoverBeforeBe24CompletesVehicleExecution() {
		prepareRoad(ExecutionStatus.DESTINATION);

		assertThatThrownBy(() -> service.recordRoadHandover(
				ROAD_VEHICLE_ID, "Recipient", validJpeg(), null))
				.isInstanceOf(RoutePlanValidationException.class)
				.hasMessageContaining("destination arrival and final welfare");
		verify(storage, never()).upload(any(), anyString(), anyString(), anyBoolean());
	}

	@Test
	void airPersistsOnePodCompletesExecutionAndInvokesFinalCoordinator() {
		AirFixture fixture = prepareAir();
		AtomicReference<ProofOfDelivery> saved = new AtomicReference<>();
		when(proofRepository.saveAndFlush(any(ProofOfDelivery.class))).thenAnswer(invocation -> {
			ProofOfDelivery proof = invocation.getArgument(0);
			saved.set(proof);
			return proof;
		});
		when(proofRepository.findByAirLegExecutionId(AIR_EXECUTION_ID)).thenAnswer(invocation ->
				Optional.ofNullable(saved.get()));
		when(airExecutionRepository.saveAndFlush(fixture.execution())).thenReturn(fixture.execution());
		when(storage.upload(any(byte[].class), anyString(), anyString(), anyBoolean()))
				.thenReturn("https://storage.example/air-pod.jpg");
		org.mockito.Mockito.doAnswer(invocation ->
				((BooleanSupplier) invocation.getArgument(1)).getAsBoolean())
				.when(coordinator).completeFinalLegWhenReady(any(), any());

		ProofOfDeliveryResponse response = service.recordAirHandover(
				LEG_ID, "Recipient", validJpeg(), null);

		assertThat(response.airLegExecutionId()).isEqualTo(AIR_EXECUTION_ID);
		assertThat(fixture.execution().getStatus()).isEqualTo(ExecutionStatus.COMPLETED);
		verify(coordinator).completeFinalLegWhenReady(any(), any());
	}

	@Test
	void retryReturnsPersistedRoadPodWithoutUploadingOrCompletingAgain() {
		RoadFixture fixture = prepareRoad(ExecutionStatus.COMPLETED);
		ProofOfDelivery existing = ProofOfDelivery.forRoad(ROAD_EXECUTION_ID, "Recipient",
				"https://storage.example/existing-pod.jpg", null, ESCORT_ID, NOW.minusMinutes(1));
		when(proofRepository.findByRoadVehicleExecutionId(ROAD_EXECUTION_ID))
				.thenReturn(Optional.of(existing));
		when(roadVehicleRepository.findAllByRouteLegId(LEG_ID)).thenReturn(List.of(fixture.roadVehicle()));
		when(roadExecutionRepository.findAllByRoadLegVehicleIdIn(any())).thenReturn(List.of(fixture.execution()));
		when(proofRepository.findAllByRoadVehicleExecutionIdIn(any())).thenReturn(List.of(existing));

		ProofOfDeliveryResponse response = service.recordRoadHandover(
				ROAD_VEHICLE_ID, "Changed", validJpeg(), "Duplicate");

		assertThat(response.proofPhotoUrl()).isEqualTo("https://storage.example/existing-pod.jpg");
		verify(storage, never()).upload(any(), anyString(), anyString(), anyBoolean());
		verify(coordinator, never()).completeFinalLegWhenReady(any(), any());
	}

	@Test
	void wrongEscortCannotRecordRoadHandover() {
		prepareRoad(ExecutionStatus.COMPLETED);
		UUID wrongEscort = UUID.randomUUID();
		actAs(wrongEscort);

		assertThatThrownBy(() -> service.recordRoadHandover(
				ROAD_VEHICLE_ID, "Recipient", validJpeg(), null))
				.isInstanceOf(AccessDeniedException.class);
		verify(proofRepository, never()).saveAndFlush(any());
	}

	@Test
	void proofPhotoMustRemainDistinctFromFinalWelfarePhoto() {
		prepareAir();
		when(storage.upload(any(byte[].class), anyString(), anyString(), anyBoolean()))
				.thenReturn("https://storage.example/final-welfare.jpg");

		assertThatThrownBy(() -> service.recordAirHandover(
				LEG_ID, "Recipient", validJpeg(), null))
				.isInstanceOf(RoutePlanValidationException.class)
				.hasMessageContaining("distinct");
		verify(proofRepository, never()).saveAndFlush(any());
	}

	private RoadFixture prepareRoad(ExecutionStatus status) {
		RouteLeg leg = finalLeg(RouteLegType.ROAD);
		RoadLegVehicle roadVehicle = new RoadLegVehicle(LEG_ID, UUID.randomUUID());
		ReflectionTestUtils.setField(roadVehicle, "id", ROAD_VEHICLE_ID);
		RoadVehicleExecution execution = new RoadVehicleExecution(ROAD_VEHICLE_ID, UUID.randomUUID(), ESCORT_ID);
		ReflectionTestUtils.setField(execution, "id", ROAD_EXECUTION_ID);
		moveRoadExecution(execution, status);
		when(roadExecutionRepository.findByRoadLegVehicleIdForUpdate(ROAD_VEHICLE_ID))
				.thenReturn(Optional.of(execution));
		when(roadVehicleRepository.findById(ROAD_VEHICLE_ID)).thenReturn(Optional.of(roadVehicle));
		when(routeLegRepository.findById(LEG_ID)).thenReturn(Optional.of(leg));
		lenient().when(routeLegRepository.findAllByRoutePlanIdOrderBySequenceNoAsc(PLAN_ID)).thenReturn(List.of(leg));
		lenient().when(proofRepository.findByRoadVehicleExecutionId(ROAD_EXECUTION_ID)).thenReturn(Optional.empty());
		lenient().when(roadHorseRepository.findAllByRouteLegId(LEG_ID)).thenReturn(List.of(
				new RoadLegVehicleHorse(LEG_ID, ROAD_VEHICLE_ID, ORDER_HORSE_ID)));
		lenient().when(welfareRepository.findByRoadVehicleExecutionIdAndEventType(
				ROAD_EXECUTION_ID, WelfareEventType.FINAL_DESTINATION)).thenReturn(Optional.of(
						new WelfareEvidence(ROAD_EXECUTION_ID, null, WelfareEventType.FINAL_DESTINATION,
								"https://storage.example/final-welfare.jpg", "Well", ESCORT_ID, NOW)));
		actAs(ESCORT_ID);
		return new RoadFixture(roadVehicle, execution, leg);
	}

	private AirFixture prepareAir() {
		RouteLeg leg = finalLeg(RouteLegType.AIR);
		AirLegExecution execution = new AirLegExecution(LEG_ID, ESCORT_ID);
		ReflectionTestUtils.setField(execution, "id", AIR_EXECUTION_ID);
		execution.start(NOW.minusHours(2));
		execution.arriveAtDestination(NOW.minusMinutes(15));
		when(airExecutionRepository.findByRouteLegIdForUpdate(LEG_ID)).thenReturn(Optional.of(execution));
		when(routeLegRepository.findById(LEG_ID)).thenReturn(Optional.of(leg));
		when(routeLegRepository.findAllByRoutePlanIdOrderBySequenceNoAsc(PLAN_ID)).thenReturn(List.of(leg));
		when(proofRepository.findByAirLegExecutionId(AIR_EXECUTION_ID)).thenReturn(Optional.empty());
		when(welfareRepository.findByAirLegExecutionIdAndEventType(
				AIR_EXECUTION_ID, WelfareEventType.FINAL_DESTINATION)).thenReturn(Optional.of(
						new WelfareEvidence(AIR_EXECUTION_ID, WelfareEventType.FINAL_DESTINATION,
								"https://storage.example/final-welfare.jpg", "Well", ESCORT_ID, NOW)));
		actAs(ESCORT_ID);
		return new AirFixture(execution, leg);
	}

	private RouteLeg finalLeg(RouteLegType type) {
		RouteLeg leg = new RouteLeg(PLAN_ID, 1, type, "Origin", "Destination",
				NOW.minusHours(3), NOW.minusHours(1), type == RouteLegType.AIR ? "Airline" : null,
				type == RouteLegType.AIR ? "REF" : null, type == RouteLegType.AIR ? 2 : null,
				null, null);
		ReflectionTestUtils.setField(leg, "id", LEG_ID);
		leg.markReady();
		leg.start();
		return leg;
	}

	private RoadVehicleExecution completedRoadExecution(UUID roadVehicleId, UUID executionId) {
		RoadVehicleExecution execution = new RoadVehicleExecution(roadVehicleId, UUID.randomUUID(), UUID.randomUUID());
		ReflectionTestUtils.setField(execution, "id", executionId);
		moveRoadExecution(execution, ExecutionStatus.COMPLETED);
		return execution;
	}

	private void moveRoadExecution(RoadVehicleExecution execution, ExecutionStatus status) {
		execution.start(NOW.minusHours(2));
		if (status == ExecutionStatus.IN_PROGRESS) return;
		execution.arriveAtDestination(NOW.minusMinutes(30));
		if (status == ExecutionStatus.DESTINATION) return;
		execution.complete(NOW.minusMinutes(20));
	}

	private AtomicReference<ProofOfDelivery> saveRoadProof() {
		AtomicReference<ProofOfDelivery> saved = new AtomicReference<>();
		when(proofRepository.saveAndFlush(any(ProofOfDelivery.class))).thenAnswer(invocation -> {
			ProofOfDelivery proof = invocation.getArgument(0);
			saved.set(proof);
			return proof;
		});
		return saved;
	}

	private void actAs(UUID actorId) {
		UserAccount escort = UserAccount.createActive("Escort", "escort@test.local", null,
				"hash", UserRole.ESCORT);
		ReflectionTestUtils.setField(escort, "id", actorId);
		when(currentUserProvider.getCurrentUserId()).thenReturn(actorId);
		lenient().when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.ESCORT);
		lenient().when(userRepository.findByIdForUpdate(actorId)).thenReturn(Optional.of(escort));
	}

	private MockMultipartFile validJpeg() {
		return new MockMultipartFile("photo", "pod.jpg", "image/jpeg",
				new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff, 0x00});
	}

	private record RoadFixture(RoadLegVehicle roadVehicle, RoadVehicleExecution execution, RouteLeg leg) { }
	private record AirFixture(AirLegExecution execution, RouteLeg leg) { }
}
