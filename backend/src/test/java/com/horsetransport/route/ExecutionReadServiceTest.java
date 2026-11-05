package com.horsetransport.route;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.horsetransport.delivery.ProofOfDeliveryRepository;
import com.horsetransport.horse.Horse;
import com.horsetransport.horse.HorseRepository;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderHorse;
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
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ExecutionReadServiceTest {

	private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 27, 9, 0);
	private static final UUID ACTOR_ID = UUID.randomUUID();
	private static final UUID ORDER_ID = UUID.randomUUID();
	private static final UUID PLAN_ID = UUID.randomUUID();

	@Mock private RoadVehicleExecutionRepository roadExecutionRepository;
	@Mock private AirLegExecutionRepository airExecutionRepository;
	@Mock private RoadLegVehicleRepository roadVehicleRepository;
	@Mock private RoadLegVehicleHorseRepository allocationRepository;
	@Mock private RouteLegRepository routeLegRepository;
	@Mock private RoutePlanRepository routePlanRepository;
	@Mock private TransportOrderRepository orderRepository;
	@Mock private VehicleRepository vehicleRepository;
	@Mock private CheckpointRepository checkpointRepository;
	@Mock private VehicleCheckpointArrivalRepository arrivalRepository;
	@Mock private WelfareEvidenceRepository welfareRepository;
	@Mock private ProofOfDeliveryRepository proofRepository;
	@Mock private HorseRepository horseRepository;
	@Mock private UserRepository userRepository;
	@Mock private CurrentUserProvider currentUserProvider;

	private ExecutionReadService service;

	@BeforeEach
	void setUp() {
		service = new ExecutionReadService(roadExecutionRepository, airExecutionRepository,
				roadVehicleRepository, allocationRepository, routeLegRepository, routePlanRepository,
				orderRepository, vehicleRepository, checkpointRepository, arrivalRepository,
				welfareRepository, proofRepository, horseRepository, userRepository, currentUserProvider);
	}

	@Test
	void driverQueueUsesAuthenticatedAssignmentAndReturnsPersistedProgressWithoutNPlusOne() {
		UserAccount driver = actor(UserRole.DRIVER, UserStatus.ACTIVE);
		when(currentUserProvider.getCurrentUserId()).thenReturn(ACTOR_ID);
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.DRIVER);
		when(userRepository.findById(ACTOR_ID)).thenReturn(Optional.of(driver));

		RoadFixture fixture = roadFixture(driver.getId(), UUID.randomUUID());
		when(roadExecutionRepository.findActiveAssignedToDriver(ACTOR_ID))
				.thenReturn(List.of(fixture.execution()));
		stubRoadData(fixture);

		RoadExecutionReadResponse.Summary response = service.assignedRoad().executions().get(0);

		assertThat(response.executionId()).isEqualTo(fixture.execution().getId());
		assertThat(response.roadLegVehicleId()).isEqualTo(fixture.roadVehicle().getId());
		assertThat(response.orderId()).isEqualTo(ORDER_ID);
		assertThat(response.horseCount()).isEqualTo(1);
		assertThat(response.reachedCheckpointCount()).isEqualTo(1);
		assertThat(response.pendingCheckpointWelfareCount()).isZero();
		assertThat(response.finalWelfareRecorded()).isTrue();
		verify(roadExecutionRepository, never()).findActiveAssignedToEscort(any());
		verify(routeLegRepository).findAllById(any());
		verify(checkpointRepository).findAllByRouteLegIdIn(any());
		verify(arrivalRepository).findAllByRoadVehicleExecutionIdIn(any());
		verify(welfareRepository).findAllByRoadVehicleExecutionIdIn(any());
	}

	@Test
	void secondRoadVehicleCanStillStartAfterFirstVehicleStartsSharedLeg() {
		UserAccount driver = actor(UserRole.DRIVER, UserStatus.ACTIVE);
		when(currentUserProvider.getCurrentUserId()).thenReturn(ACTOR_ID);
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.DRIVER);
		when(userRepository.findById(ACTOR_ID)).thenReturn(Optional.of(driver));

		RoutePlan plan = plan();
		RouteLeg leg = leg(1, RouteLegType.ROAD, "Stable", "Airport");
		leg.markReady();
		leg.start();
		Vehicle firstVehicle = new Vehicle("51H-111.11", "Horse Van A", "TRUCK", 2,
				VehicleStatus.AVAILABLE, null);
		Vehicle secondVehicle = new Vehicle("51H-222.22", "Horse Van B", "TRUCK", 2,
				VehicleStatus.AVAILABLE, null);
		RoadLegVehicle firstRoadVehicle = new RoadLegVehicle(leg.getId(), firstVehicle.getId());
		RoadLegVehicle secondRoadVehicle = new RoadLegVehicle(leg.getId(), secondVehicle.getId());
		RoadVehicleExecution firstExecution = new RoadVehicleExecution(firstRoadVehicle.getId(),
				UUID.randomUUID(), UUID.randomUUID());
		firstExecution.start(NOW.minusMinutes(5));
		UUID secondEscortId = UUID.randomUUID();
		RoadVehicleExecution secondExecution = new RoadVehicleExecution(secondRoadVehicle.getId(),
				ACTOR_ID, secondEscortId);
		TransportOrder order = order(org.mockito.Mockito.mock(TransportOrderHorse.class));

		when(roadExecutionRepository.findByIdAndDriverId(secondExecution.getId(), ACTOR_ID))
				.thenReturn(Optional.of(secondExecution));
		when(roadVehicleRepository.findAllById(any())).thenReturn(List.of(secondRoadVehicle));
		when(roadVehicleRepository.findAllByRouteLegIdIn(any()))
				.thenReturn(List.of(firstRoadVehicle, secondRoadVehicle));
		when(routeLegRepository.findAllById(any())).thenReturn(List.of(leg));
		when(routeLegRepository.findAllByRoutePlanIdIn(any())).thenReturn(List.of(leg));
		when(routePlanRepository.findAllById(any())).thenReturn(List.of(plan));
		when(orderRepository.findAllById(any())).thenReturn(List.of(order));
		when(vehicleRepository.findAllById(any())).thenReturn(List.of(firstVehicle, secondVehicle));
		when(allocationRepository.findAllByRouteLegIdIn(any())).thenReturn(List.of());
		when(checkpointRepository.findAllByRouteLegIdIn(any())).thenReturn(List.of());
		when(arrivalRepository.findAllByRoadVehicleExecutionIdIn(any())).thenReturn(List.of());
		when(welfareRepository.findAllByRoadVehicleExecutionIdIn(any())).thenReturn(List.of());
		when(proofRepository.findAllByRoadVehicleExecutionIdIn(any())).thenReturn(List.of());
		when(roadExecutionRepository.findAllByRoadLegVehicleIdIn(any()))
				.thenReturn(List.of(firstExecution, secondExecution));
		when(userRepository.findAllById(any())).thenReturn(List.of(driver, staff(secondEscortId, "Escort")));

		RoadExecutionReadResponse.Detail response = service.roadDetail(secondExecution.getId());

		assertThat(response.status()).isEqualTo(ExecutionStatus.NOT_STARTED);
		assertThat(response.routeLegStatus()).isEqualTo(RouteLegStatus.IN_PROGRESS);
		assertThat(response.availableActions().start()).isTrue();
	}

	@Test
	void roadDetailReturnsOrderedCheckpointsEvidenceHorsesAndRoleSensitiveActions() {
		UserAccount escort = actor(UserRole.ESCORT, UserStatus.ACTIVE);
		when(currentUserProvider.getCurrentUserId()).thenReturn(ACTOR_ID);
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.ESCORT);
		when(userRepository.findById(ACTOR_ID)).thenReturn(Optional.of(escort));
		RoadFixture fixture = roadFixture(UUID.randomUUID(), ACTOR_ID);
		when(roadExecutionRepository.findByIdAndEscortId(fixture.execution().getId(), ACTOR_ID))
				.thenReturn(Optional.of(fixture.execution()));
		stubRoadData(fixture);
		when(userRepository.findAllById(any())).thenReturn(List.of(
				staff(fixture.execution().getDriverId(), "Driver"),
				staff(ACTOR_ID, "Escort")));
		when(horseRepository.findAllById(any())).thenReturn(List.of(fixture.horse()));

		RoadExecutionReadResponse.Detail response = service.roadDetail(fixture.execution().getId());

		assertThat(response.checkpoints()).extracting(ExecutionReadComponents.RoadCheckpoint::sequenceNo)
				.containsExactly(1, 2);
		assertThat(response.checkpoints().get(0).welfareEvidence().photoName())
				.isEqualTo("checkpoint-welfare.png");
		assertThat(response.finalWelfareEvidence().photoName()).isEqualTo("final-welfare.jpg");
		assertThat(response.lastUpdatedAt()).isEqualTo(NOW.minusMinutes(5));
		assertThat(response.horses()).extracting(ExecutionReadComponents.Horse::name)
				.containsExactly("Silver Star");
		assertThat(response.availableActions().checkpointWelfareIds()).isEmpty();
		assertThat(response.availableActions().finalWelfare()).isFalse();
	}

	@Test
	void airQueueAndDetailReturnPersistedWelfareAndEligibleExplicitComplete() {
		UserAccount escort = actor(UserRole.ESCORT, UserStatus.ACTIVE);
		when(currentUserProvider.getCurrentUserId()).thenReturn(ACTOR_ID);
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.ESCORT);
		when(userRepository.findById(ACTOR_ID)).thenReturn(Optional.of(escort));
		AirFixture fixture = airFixture();
		when(airExecutionRepository.findActiveAssignedToEscort(ACTOR_ID))
				.thenReturn(List.of(fixture.execution()));
		when(airExecutionRepository.findByIdAndEscortId(fixture.execution().getId(), ACTOR_ID))
				.thenReturn(Optional.of(fixture.execution()));
		stubAirData(fixture);

		AirExecutionReadResponse.Summary summary = service.assignedAir().executions().get(0);
		assertThat(summary.availableActions().complete()).isTrue();
		assertThat(summary.welfareRecorded()).isTrue();

		when(userRepository.findAllById(any())).thenReturn(List.of(escort));
		when(horseRepository.findAllById(any())).thenReturn(List.of(fixture.horse()));
		AirExecutionReadResponse.Detail detail = service.airDetail(fixture.execution().getId());
		assertThat(detail.routeLegId()).isEqualTo(fixture.leg().getId());
		assertThat(detail.welfareEvidence().photoName()).isEqualTo("final-welfare.jpg");
		assertThat(detail.availableActions().complete()).isTrue();
		assertThat(detail.horses()).extracting(ExecutionReadComponents.Horse::name)
				.containsExactly("Silver Star");
	}

	@Test
	void foreignAssignmentIsHiddenAndInactiveStaffIsDenied() {
		UserAccount escort = actor(UserRole.ESCORT, UserStatus.ACTIVE);
		when(currentUserProvider.getCurrentUserId()).thenReturn(ACTOR_ID);
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.ESCORT);
		when(userRepository.findById(ACTOR_ID)).thenReturn(Optional.of(escort));
		UUID executionId = UUID.randomUUID();
		when(roadExecutionRepository.findByIdAndEscortId(executionId, ACTOR_ID)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.roadDetail(executionId))
				.isInstanceOf(ExecutionNotFoundException.class);

		ReflectionTestUtils.setField(escort, "status", UserStatus.INACTIVE);
		assertThatThrownBy(() -> service.assignedAir()).isInstanceOf(AccessDeniedException.class);
		verify(airExecutionRepository, never()).findActiveAssignedToEscort(any());
	}

	private void stubRoadData(RoadFixture fixture) {
		when(roadVehicleRepository.findAllById(any())).thenReturn(List.of(fixture.roadVehicle()));
		when(roadVehicleRepository.findAllByRouteLegIdIn(any())).thenReturn(List.of(fixture.roadVehicle()));
		when(routeLegRepository.findAllById(any())).thenReturn(List.of(fixture.leg()));
		when(routeLegRepository.findAllByRoutePlanIdIn(any())).thenReturn(List.of(fixture.leg()));
		when(routePlanRepository.findAllById(any())).thenReturn(List.of(fixture.plan()));
		when(orderRepository.findAllById(any())).thenReturn(List.of(fixture.order()));
		when(vehicleRepository.findAllById(any())).thenReturn(List.of(fixture.vehicle()));
		when(allocationRepository.findAllByRouteLegIdIn(any())).thenReturn(List.of(fixture.allocation()));
		when(checkpointRepository.findAllByRouteLegIdIn(any()))
				.thenReturn(List.of(fixture.secondCheckpoint(), fixture.firstCheckpoint()));
		when(arrivalRepository.findAllByRoadVehicleExecutionIdIn(any()))
				.thenReturn(List.of(fixture.arrival()));
		when(welfareRepository.findAllByRoadVehicleExecutionIdIn(any()))
				.thenReturn(List.of(fixture.checkpointWelfare(), fixture.finalWelfare()));
		when(proofRepository.findAllByRoadVehicleExecutionIdIn(any())).thenReturn(List.of());
		when(roadExecutionRepository.findAllByRoadLegVehicleIdIn(any()))
				.thenReturn(List.of(fixture.execution()));
	}

	private void stubAirData(AirFixture fixture) {
		when(routeLegRepository.findAllById(any())).thenReturn(List.of(fixture.leg()));
		when(routeLegRepository.findAllByRoutePlanIdIn(any()))
				.thenReturn(List.of(fixture.leg(), fixture.finalLeg()));
		when(routePlanRepository.findAllById(any())).thenReturn(List.of(fixture.plan()));
		when(orderRepository.findAllById(any())).thenReturn(List.of(fixture.order()));
		when(welfareRepository.findAllByAirLegExecutionIdIn(any())).thenReturn(List.of(fixture.welfare()));
		when(proofRepository.findAllByAirLegExecutionIdIn(any())).thenReturn(List.of());
	}

	private RoadFixture roadFixture(UUID driverId, UUID escortId) {
		RoutePlan plan = plan();
		RouteLeg leg = leg(1, RouteLegType.ROAD, "Stable", "Airport");
		leg.markReady();
		leg.start();
		ReflectionTestUtils.setField(leg, "updatedAt", NOW.minusHours(3));
		Vehicle vehicle = new Vehicle("51H-123.45", "Horse Van", "TRUCK", 2,
				VehicleStatus.AVAILABLE, null);
		RoadLegVehicle roadVehicle = new RoadLegVehicle(leg.getId(), vehicle.getId());
		RoadVehicleExecution execution = new RoadVehicleExecution(roadVehicle.getId(), driverId, escortId);
		ReflectionTestUtils.setField(execution, "assignedAt", NOW.minusDays(1));
		execution.start(NOW.minusHours(2));
		execution.arriveAtDestination(NOW.minusMinutes(20));
		TransportOrderHorse orderHorse = org.mockito.Mockito.mock(TransportOrderHorse.class);
		UUID orderHorseId = UUID.randomUUID();
		UUID horseId = UUID.randomUUID();
		lenient().when(orderHorse.getId()).thenReturn(orderHorseId);
		lenient().when(orderHorse.getHorseId()).thenReturn(horseId);
		TransportOrder order = order(orderHorse);
		RoadLegVehicleHorse allocation = new RoadLegVehicleHorse(leg.getId(), roadVehicle.getId(), orderHorseId);
		Checkpoint first = new Checkpoint(leg.getId(), 1, "Rest", CheckpointType.REST_STOP,
				"US", 15, 30, null);
		Checkpoint second = new Checkpoint(leg.getId(), 2, "Border", CheckpointType.BORDER,
				"US", null, null, null);
		VehicleCheckpointArrival arrival = new VehicleCheckpointArrival(execution.getId(), first.getId(),
				driverId, NOW.minusHours(1));
		WelfareEvidence checkpointWelfare = new WelfareEvidence(execution.getId(), first.getId(),
				WelfareEventType.CHECKPOINT, "https://res.cloudinary.com/demo/v1/a.png?x=1",
				"Calm", escortId, NOW.minusMinutes(5));
		WelfareEvidence finalWelfare = new WelfareEvidence(execution.getId(), null,
				WelfareEventType.FINAL_DESTINATION, "https://res.cloudinary.com/demo/image/upload/t_x/v2/a",
				"Well", escortId, NOW.minusMinutes(10));
		Horse horse = org.mockito.Mockito.mock(Horse.class);
		lenient().when(horse.getId()).thenReturn(horseId);
		lenient().when(horse.getName()).thenReturn("Silver Star");
		lenient().when(horse.getMicrochipId()).thenReturn("MICRO-1");
		return new RoadFixture(plan, leg, order, vehicle, roadVehicle, execution, allocation,
				first, second, arrival, checkpointWelfare, finalWelfare, horse);
	}

	private AirFixture airFixture() {
		RoutePlan plan = plan();
		RouteLeg leg = leg(1, RouteLegType.AIR, "Airport A", "Airport B");
		leg.markReady();
		leg.start();
		RouteLeg finalLeg = leg(2, RouteLegType.ROAD, "Airport B", "Stable");
		AirLegExecution execution = new AirLegExecution(leg.getId(), ACTOR_ID);
		execution.start(NOW.minusHours(4));
		execution.arriveAtDestination(NOW.minusMinutes(20));
		TransportOrderHorse orderHorse = org.mockito.Mockito.mock(TransportOrderHorse.class);
		UUID horseId = UUID.randomUUID();
		when(orderHorse.getId()).thenReturn(UUID.randomUUID());
		when(orderHorse.getHorseId()).thenReturn(horseId);
		TransportOrder order = order(orderHorse);
		WelfareEvidence welfare = new WelfareEvidence(execution.getId(), WelfareEventType.FINAL_DESTINATION,
				"https://files/welfare.jpeg?token=demo", "Calm", ACTOR_ID, NOW.minusMinutes(10));
		Horse horse = org.mockito.Mockito.mock(Horse.class);
		when(horse.getId()).thenReturn(horseId);
		when(horse.getName()).thenReturn("Silver Star");
		when(horse.getMicrochipId()).thenReturn("MICRO-1");
		return new AirFixture(plan, leg, finalLeg, order, execution, welfare, horse);
	}

	private RoutePlan plan() {
		RoutePlan plan = new RoutePlan(ORDER_ID, UUID.randomUUID());
		ReflectionTestUtils.setField(plan, "id", PLAN_ID);
		ReflectionTestUtils.setField(plan, "status", RoutePlanStatus.APPROVED);
		return plan;
	}

	private RouteLeg leg(int sequence, RouteLegType type, String origin, String destination) {
		RouteLeg leg = new RouteLeg(PLAN_ID, sequence, type, origin, destination,
				NOW.plusDays(sequence), NOW.plusDays(sequence).plusHours(4),
				type == RouteLegType.AIR ? "Airline" : null,
				type == RouteLegType.AIR ? "REF" : null,
				type == RouteLegType.AIR ? 2 : null, type == RouteLegType.ROAD ? "TRUCK" : null, null);
		ReflectionTestUtils.setField(leg, "id", UUID.randomUUID());
		return leg;
	}

	private TransportOrder order(TransportOrderHorse orderHorse) {
		TransportOrder order = org.mockito.Mockito.mock(TransportOrder.class);
		when(order.getId()).thenReturn(ORDER_ID);
		when(order.getOrderCode()).thenReturn("ORD-S3-001");
		when(order.getStatus()).thenReturn(OrderStatus.IN_PROGRESS);
		lenient().when(order.getHorses()).thenReturn(List.of(orderHorse));
		return order;
	}

	private UserAccount actor(UserRole role, UserStatus status) {
		UserAccount account = UserAccount.createActive(role.name(), role.name().toLowerCase() + "@test.local",
				null, "hash", role);
		ReflectionTestUtils.setField(account, "id", ACTOR_ID);
		ReflectionTestUtils.setField(account, "status", status);
		return account;
	}

	private UserAccount staff(UUID id, String name) {
		UserAccount account = UserAccount.createActive(name, name.toLowerCase() + "@test.local",
				null, "hash", name.equals("Driver") ? UserRole.DRIVER : UserRole.ESCORT);
		ReflectionTestUtils.setField(account, "id", id);
		return account;
	}

	private record RoadFixture(RoutePlan plan, RouteLeg leg, TransportOrder order, Vehicle vehicle,
			RoadLegVehicle roadVehicle, RoadVehicleExecution execution, RoadLegVehicleHorse allocation,
			Checkpoint firstCheckpoint, Checkpoint secondCheckpoint, VehicleCheckpointArrival arrival,
			WelfareEvidence checkpointWelfare, WelfareEvidence finalWelfare, Horse horse) { }

	private record AirFixture(RoutePlan plan, RouteLeg leg, RouteLeg finalLeg, TransportOrder order,
			AirLegExecution execution, WelfareEvidence welfare, Horse horse) { }
}
