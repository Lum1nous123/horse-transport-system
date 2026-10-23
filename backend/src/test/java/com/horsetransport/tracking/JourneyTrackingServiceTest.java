package com.horsetransport.tracking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import java.lang.reflect.Constructor;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.horsetransport.delivery.ProofOfDelivery;
import com.horsetransport.delivery.ProofOfDeliveryRepository;
import com.horsetransport.horse.Horse;
import com.horsetransport.horse.HorseRepository;
import com.horsetransport.order.OrderNotFoundException;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderHorse;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.route.AirLegExecution;
import com.horsetransport.route.AirLegExecutionRepository;
import com.horsetransport.route.Checkpoint;
import com.horsetransport.route.CheckpointRepository;
import com.horsetransport.route.CheckpointType;
import com.horsetransport.route.ExecutionStatus;
import com.horsetransport.route.RoadLegVehicle;
import com.horsetransport.route.RoadLegVehicleHorse;
import com.horsetransport.route.RoadLegVehicleHorseRepository;
import com.horsetransport.route.RoadLegVehicleRepository;
import com.horsetransport.route.RoadVehicleExecution;
import com.horsetransport.route.RoadVehicleExecutionRepository;
import com.horsetransport.route.RouteLeg;
import com.horsetransport.route.RouteLegRepository;
import com.horsetransport.route.RouteLegStatus;
import com.horsetransport.route.RouteLegType;
import com.horsetransport.route.RoutePlan;
import com.horsetransport.route.RoutePlanRepository;
import com.horsetransport.route.RoutePlanStatus;
import com.horsetransport.route.Vehicle;
import com.horsetransport.route.VehicleCheckpointArrival;
import com.horsetransport.route.VehicleCheckpointArrivalRepository;
import com.horsetransport.route.VehicleRepository;
import com.horsetransport.route.VehicleStatus;
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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class JourneyTrackingServiceTest {

	private static final UUID CUSTOMER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final UUID ORDER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
	private static final UUID PLAN_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
	private static final UUID ROAD_LEG_ID = UUID.fromString("44444444-4444-4444-4444-444444444444");
	private static final UUID AIR_LEG_ID = UUID.fromString("55555555-5555-5555-5555-555555555555");

	@Mock private TransportOrderRepository orderRepository;
	@Mock private RoutePlanRepository routePlanRepository;
	@Mock private RouteLegRepository routeLegRepository;
	@Mock private RoadLegVehicleRepository roadVehicleRepository;
	@Mock private RoadLegVehicleHorseRepository allocationRepository;
	@Mock private RoadVehicleExecutionRepository roadExecutionRepository;
	@Mock private AirLegExecutionRepository airExecutionRepository;
	@Mock private CheckpointRepository checkpointRepository;
	@Mock private VehicleCheckpointArrivalRepository arrivalRepository;
	@Mock private WelfareEvidenceRepository welfareRepository;
	@Mock private ProofOfDeliveryRepository proofRepository;
	@Mock private VehicleRepository vehicleRepository;
	@Mock private HorseRepository horseRepository;
	@Mock private UserRepository userRepository;
	@Mock private CurrentUserProvider currentUserProvider;

	private JourneyTrackingService service;

	@BeforeEach
	void setUp() {
		service = new JourneyTrackingService(orderRepository, routePlanRepository, routeLegRepository,
				roadVehicleRepository, allocationRepository, roadExecutionRepository,
				airExecutionRepository, checkpointRepository, arrivalRepository, welfareRepository,
				proofRepository, vehicleRepository, horseRepository, userRepository, currentUserProvider);
		lenient().when(currentUserProvider.getCurrentUserId()).thenReturn(CUSTOMER_ID);
	}

	@Test
	void ownerCustomerReceivesOrderedRoadAirTrackingWithoutPrivateEmailOrFakeCheckpointEvidence()
			throws Exception {
		Fixture fixture = stubCompleteJourney(UserRole.CUSTOMER);

		JourneyTrackingResponse response = service.getTracking(ORDER_ID);

		assertThat(response.orderId()).isEqualTo(ORDER_ID);
		assertThat(response.deliveredAt()).isEqualTo(fixture.deliveredAt());
		assertThat(response.legs()).extracting(JourneyTrackingResponse.Leg::sequenceNo)
				.containsExactly(1, 2);

		JourneyTrackingResponse.RoadVehicle road = response.legs().get(0).roadVehicles().get(0);
		assertThat(road.executionStatus()).isEqualTo(ExecutionStatus.COMPLETED);
		assertThat(road.horses()).extracting(JourneyTrackingResponse.Horse::name)
				.containsExactly("Silver Star");
		assertThat(road.driver().fullName()).isEqualTo("Dana Driver");
		assertThat(road.driver().phone()).isNull();
		assertThat(road.escort().phone()).isEqualTo("0909000111");
		assertThat(road.checkpoints()).hasSize(2);
		assertThat(road.checkpoints().get(0).reached()).isTrue();
		assertThat(road.checkpoints().get(0).welfare().note()).isEqualTo("Calm at checkpoint");
		assertThat(road.checkpoints().get(1).reached()).isFalse();
		assertThat(road.checkpoints().get(1).arrivedAt()).isNull();
		assertThat(road.checkpoints().get(1).welfare()).isNull();
		assertThat(road.finalWelfare().eventType()).isEqualTo(WelfareEventType.FINAL_DESTINATION);
		assertThat(road.proofOfDelivery().recipientName()).isEqualTo("Road Recipient");

		JourneyTrackingResponse.Leg airLeg = response.legs().get(1);
		assertThat(airLeg.roadVehicles()).isEmpty();
		assertThat(airLeg.airExecution()).isNotNull();
		assertThat(airLeg.airExecution().status()).isEqualTo(ExecutionStatus.COMPLETED);
		assertThat(airLeg.airExecution().escort().phone()).isEqualTo("0909000222");
		assertThat(airLeg.airExecution().finalWelfare().note()).isEqualTo("Calm after flight");
		assertThat(airLeg.airExecution().proofOfDelivery().recipientName()).isEqualTo("Air Recipient");

		String json = new ObjectMapper().registerModule(new JavaTimeModule()).writeValueAsString(response);
		assertThat(json).doesNotContain("userId", "email", "driver@example.test", "escort@example.test");
	}

	@Test
	void foreignCustomerCannotReadTracking() {
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.CUSTOMER);
		when(orderRepository.findByIdAndCustomerId(ORDER_ID, CUSTOMER_ID)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.getTracking(ORDER_ID))
				.isInstanceOf(OrderNotFoundException.class);
	}

	@Test
	void logisticsManagerUsesExistingProjectWideOrderVisibility() {
		stubCompleteJourney(UserRole.LOGISTICS_MANAGER);

		JourneyTrackingResponse response = service.getTracking(ORDER_ID);

		assertThat(response.orderId()).isEqualTo(ORDER_ID);
	}

	@Test
	void unrelatedRolesAreDeniedByServiceDefenseInDepth() {
		for (UserRole role : List.of(UserRole.TRANSPORT_SPECIALIST,
				UserRole.FLEET_ROUTE_COORDINATOR, UserRole.DRIVER, UserRole.ESCORT)) {
			when(currentUserProvider.getCurrentUserRole()).thenReturn(role);
			assertThatThrownBy(() -> service.getTracking(ORDER_ID))
					.isInstanceOf(AccessDeniedException.class);
		}
	}

	private Fixture stubCompleteJourney(UserRole role) {
		when(currentUserProvider.getCurrentUserRole()).thenReturn(role);
		LocalDateTime deliveredAt = LocalDateTime.of(2026, 10, 23, 16, 30);
		TransportOrder order = order(deliveredAt);
		if (role == UserRole.CUSTOMER) {
			when(orderRepository.findByIdAndCustomerId(ORDER_ID, CUSTOMER_ID)).thenReturn(Optional.of(order));
		} else {
			when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));
		}

		RoutePlan plan = new RoutePlan(ORDER_ID, UUID.randomUUID());
		ReflectionTestUtils.setField(plan, "id", PLAN_ID);
		ReflectionTestUtils.setField(plan, "status", RoutePlanStatus.APPROVED);
		ReflectionTestUtils.setField(plan, "approvedAt", LocalDateTime.of(2026, 10, 20, 9, 0));
		when(routePlanRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(plan));

		RouteLeg roadLeg = leg(ROAD_LEG_ID, 1, RouteLegType.ROAD, "Stable", "Airport");
		RouteLeg airLeg = leg(AIR_LEG_ID, 2, RouteLegType.AIR, "Airport", "Destination");
		when(routeLegRepository.findAllByRoutePlanIdOrderBySequenceNoAsc(PLAN_ID))
				.thenReturn(List.of(roadLeg, airLeg));

		Vehicle vehicle = new Vehicle("51H-123.45", "Horse Van", "TRUCK", 2,
				VehicleStatus.AVAILABLE, null);
		RoadLegVehicle roadVehicle = new RoadLegVehicle(ROAD_LEG_ID, vehicle.getId());
		when(roadVehicleRepository.findAllByRouteLegIdIn(List.of(ROAD_LEG_ID)))
				.thenReturn(List.of(roadVehicle));
		when(vehicleRepository.findAllById(any())).thenReturn(List.of(vehicle));

		TransportOrderHorse orderHorse = order.getHorses().get(0);
		RoadLegVehicleHorse allocation = new RoadLegVehicleHorse(
				ROAD_LEG_ID, roadVehicle.getId(), orderHorse.getId());
		when(allocationRepository.findAllByRouteLegIdIn(List.of(ROAD_LEG_ID)))
				.thenReturn(List.of(allocation));
		Horse horse = horse(orderHorse.getHorseId());
		when(horseRepository.findAllById(any())).thenReturn(List.of(horse));

		UserAccount driver = UserAccount.createActive("Dana Driver", "driver@example.test", null,
				"hash", UserRole.DRIVER);
		UserAccount roadEscort = UserAccount.createActive("Eli Escort", "escort@example.test", "0909000111",
				"hash", UserRole.ESCORT);
		UserAccount airEscort = UserAccount.createActive("Ari Escort", "air@example.test", "0909000222",
				"hash", UserRole.ESCORT);
		when(userRepository.findAllById(any())).thenReturn(List.of(driver, roadEscort, airEscort));

		RoadVehicleExecution roadExecution = new RoadVehicleExecution(
				roadVehicle.getId(), driver.getId(), roadEscort.getId());
		roadExecution.start(LocalDateTime.of(2026, 10, 21, 8, 0));
		roadExecution.arriveAtDestination(LocalDateTime.of(2026, 10, 21, 12, 0));
		roadExecution.complete(LocalDateTime.of(2026, 10, 21, 12, 10));
		when(roadExecutionRepository.findAllByRoadLegVehicleIdIn(List.of(roadVehicle.getId())))
				.thenReturn(List.of(roadExecution));

		AirLegExecution airExecution = new AirLegExecution(AIR_LEG_ID, airEscort.getId());
		airExecution.start(LocalDateTime.of(2026, 10, 22, 8, 0));
		airExecution.arriveAtDestination(LocalDateTime.of(2026, 10, 23, 16, 0));
		airExecution.complete(LocalDateTime.of(2026, 10, 23, 16, 30));
		when(airExecutionRepository.findAllByRouteLegIdIn(List.of(AIR_LEG_ID)))
				.thenReturn(List.of(airExecution));

		Checkpoint reached = new Checkpoint(ROAD_LEG_ID, 1, "Rest Farm", CheckpointType.REST_STOP,
				"US", 30, 45, "Planned rest");
		Checkpoint unreached = new Checkpoint(ROAD_LEG_ID, 2, "Border", CheckpointType.BORDER,
				"US", null, null, "Customs plan");
		when(checkpointRepository.findAllByRouteLegIdIn(List.of(ROAD_LEG_ID)))
				.thenReturn(List.of(unreached, reached));
		VehicleCheckpointArrival arrival = new VehicleCheckpointArrival(roadExecution.getId(), reached.getId(),
				driver.getId(), LocalDateTime.of(2026, 10, 21, 10, 0));
		when(arrivalRepository.findAllByRoadVehicleExecutionIdIn(List.of(roadExecution.getId())))
				.thenReturn(List.of(arrival));

		WelfareEvidence reachedWelfare = new WelfareEvidence(roadExecution.getId(), reached.getId(),
				WelfareEventType.CHECKPOINT, "https://files/reached.jpg", "Calm at checkpoint",
				roadEscort.getId(), LocalDateTime.of(2026, 10, 21, 10, 5));
		WelfareEvidence hiddenUnreachedWelfare = new WelfareEvidence(roadExecution.getId(), unreached.getId(),
				WelfareEventType.CHECKPOINT, "https://files/hidden.jpg", "Must stay hidden",
				roadEscort.getId(), LocalDateTime.of(2026, 10, 21, 11, 0));
		WelfareEvidence roadFinal = new WelfareEvidence(roadExecution.getId(), null,
				WelfareEventType.FINAL_DESTINATION, "https://files/road-final.jpg", "Calm at road destination",
				roadEscort.getId(), LocalDateTime.of(2026, 10, 21, 12, 5));
		when(welfareRepository.findAllByRoadVehicleExecutionIdIn(List.of(roadExecution.getId())))
				.thenReturn(List.of(reachedWelfare, hiddenUnreachedWelfare, roadFinal));
		WelfareEvidence airFinal = new WelfareEvidence(airExecution.getId(),
				WelfareEventType.FINAL_DESTINATION, "https://files/air-final.jpg", "Calm after flight",
				airEscort.getId(), LocalDateTime.of(2026, 10, 23, 16, 5));
		when(welfareRepository.findAllByAirLegExecutionIdIn(List.of(airExecution.getId())))
				.thenReturn(List.of(airFinal));

		ProofOfDelivery roadProof = ProofOfDelivery.forRoad(roadExecution.getId(), "Road Recipient",
				"https://files/road-pod.jpg", null, roadEscort.getId(), deliveredAt.minusHours(1));
		ProofOfDelivery airProof = ProofOfDelivery.forAir(airExecution.getId(), "Air Recipient",
				"https://files/air-pod.jpg", "Safe handover", airEscort.getId(), deliveredAt);
		when(proofRepository.findAllByRoadVehicleExecutionIdIn(List.of(roadExecution.getId())))
				.thenReturn(List.of(roadProof));
		when(proofRepository.findAllByAirLegExecutionIdIn(List.of(airExecution.getId())))
				.thenReturn(List.of(airProof));

		return new Fixture(deliveredAt);
	}

	private TransportOrder order(LocalDateTime deliveredAt) {
		try {
			Constructor<TransportOrder> orderConstructor = TransportOrder.class
					.getDeclaredConstructor(UUID.class, String.class);
			orderConstructor.setAccessible(true);
			TransportOrder order = orderConstructor.newInstance(CUSTOMER_ID, "ORD-TRACKING");
			ReflectionTestUtils.setField(order, "id", ORDER_ID);
			ReflectionTestUtils.setField(order, "status", OrderStatus.DELIVERED);
			ReflectionTestUtils.setField(order, "originAddress", "Lexington");
			ReflectionTestUtils.setField(order, "originCountry", "United States");
			ReflectionTestUtils.setField(order, "destinationAddress", "Brussels");
			ReflectionTestUtils.setField(order, "destinationCountry", "Belgium");
			ReflectionTestUtils.setField(order, "deliveredAt", deliveredAt);

			UUID horseId = UUID.randomUUID();
			Constructor<TransportOrderHorse> orderHorseConstructor = TransportOrderHorse.class
					.getDeclaredConstructor(TransportOrder.class, UUID.class);
			orderHorseConstructor.setAccessible(true);
			TransportOrderHorse orderHorse = orderHorseConstructor.newInstance(order, horseId);
			@SuppressWarnings("unchecked")
			List<TransportOrderHorse> horses = (List<TransportOrderHorse>) ReflectionTestUtils.getField(order, "horses");
			horses.add(orderHorse);
			return order;
		} catch (ReflectiveOperationException exception) {
			throw new IllegalStateException(exception);
		}
	}

	private Horse horse(UUID horseId) {
		try {
			Constructor<Horse> constructor = Horse.class.getDeclaredConstructor(UUID.class, String.class,
					String.class, String.class, String.class, String.class, LocalDate.class, String.class);
			constructor.setAccessible(true);
			Horse horse = constructor.newInstance(CUSTOMER_ID, "Silver Star", null,
					"MICRO-TRACK", "Warmblood", "MARE", null, null);
			ReflectionTestUtils.setField(horse, "id", horseId);
			return horse;
		} catch (ReflectiveOperationException exception) {
			throw new IllegalStateException(exception);
		}
	}

	private RouteLeg leg(UUID id, int sequence, RouteLegType type, String origin, String destination) {
		RouteLeg leg = new RouteLeg(PLAN_ID, sequence, type, origin, destination,
				LocalDateTime.of(2026, 10, 21 + sequence, 8, 0),
				LocalDateTime.of(2026, 10, 21 + sequence, 16, 0),
				type == RouteLegType.AIR ? "SkyEquine" : null,
				type == RouteLegType.AIR ? "SE-100" : null,
				type == RouteLegType.AIR ? 2 : null, null, null);
		ReflectionTestUtils.setField(leg, "id", id);
		ReflectionTestUtils.setField(leg, "status", RouteLegStatus.COMPLETED);
		return leg;
	}

	private record Fixture(LocalDateTime deliveredAt) {
	}
}
