package com.horsetransport.route;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Constructor;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.horsetransport.audit.AuditEntityType;
import com.horsetransport.audit.StatusAuditRecorder;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderHorse;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class RoutePlanServiceTest {

	private static final UUID FRC_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final UUID LM_ID = UUID.fromString("99999999-9999-9999-9999-999999999999");
	private static final UUID CUSTOMER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
	private static final UUID ORDER_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
	private static final UUID ORDER_HORSE_ID = UUID.fromString("44444444-4444-4444-4444-444444444444");
	private static final UUID SECOND_ORDER_HORSE_ID = UUID.fromString("55555555-5555-5555-5555-555555555555");
	private static final UUID FOREIGN_ORDER_HORSE_ID = UUID.fromString("66666666-6666-6666-6666-666666666666");
	private static final UUID VEHICLE_ID = UUID.fromString("77777777-7777-7777-7777-777777777777");
	private static final UUID SECOND_VEHICLE_ID = UUID.fromString("88888888-8888-8888-8888-888888888888");

	@Mock private TransportOrderRepository orderRepository;
	@Mock private RoutePlanRepository routePlanRepository;
	@Mock private RouteLegRepository routeLegRepository;
	@Mock private CurrentUserProvider currentUserProvider;
	@Mock private VehicleRepository vehicleRepository;
	@Mock private RoadLegVehicleRepository roadLegVehicleRepository;
	@Mock private RoadLegVehicleHorseRepository roadLegVehicleHorseRepository;
	@Mock private CheckpointRepository checkpointRepository;
	@Mock private RoutePlanReviewRepository routePlanReviewRepository;
	@Mock private ExecutionStaffingService executionStaffingService;
	@Mock private StatusAuditRecorder statusAuditRecorder;

	private RoutePlanService service;

	@BeforeEach
	void setUp() {
		service = new RoutePlanService(orderRepository, routePlanRepository, routeLegRepository,
				vehicleRepository, roadLegVehicleRepository, roadLegVehicleHorseRepository,
				checkpointRepository, routePlanReviewRepository, executionStaffingService,
				statusAuditRecorder, currentUserProvider);

		lenient().when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.FLEET_ROUTE_COORDINATOR);
		lenient().when(currentUserProvider.getCurrentUserId()).thenReturn(FRC_ID);
		lenient().when(orderRepository.findAssignedFrcRoutePlanOrder(ORDER_ID, FRC_ID))
				.thenReturn(Optional.of(order(ORDER_HORSE_ID, SECOND_ORDER_HORSE_ID)));
		lenient().when(routeLegRepository.findAllByRoutePlanIdOrderBySequenceNoAsc(any()))
				.thenReturn(List.of());
		lenient().when(roadLegVehicleRepository.findAllByRouteLegId(any())).thenReturn(List.of());
		lenient().when(roadLegVehicleHorseRepository.findAllByRouteLegId(any())).thenReturn(List.of());
		lenient().when(vehicleRepository.findAllById(any())).thenReturn(List.of());
		lenient().when(roadLegVehicleRepository.findOverlappingAllocations(any(), any(), any(), any()))
				.thenReturn(List.of());
		lenient().when(checkpointRepository.findAllByRouteLegIdOrderBySequenceNoAsc(any()))
				.thenReturn(List.of());
		lenient().when(checkpointRepository.findAllByRouteLegIdIn(any())).thenReturn(List.of());
		lenient().when(executionStaffingService.getStaffing(any(), any()))
				.thenReturn(ExecutionStaffingResponse.empty());
		lenient().when(executionStaffingService.assignStaff(any(), any()))
				.thenReturn(ExecutionStaffingResponse.empty());
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
		RoadLegVehicle roadVehicle = new RoadLegVehicle(leg.getId(), VEHICLE_ID);

		when(routePlanRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(plan));
		when(routeLegRepository.findAllByRoutePlanIdOrderBySequenceNoAsc(plan.getId()))
				.thenReturn(List.of(leg));
		when(roadLegVehicleRepository.findAllByRouteLegId(leg.getId()))
				.thenReturn(List.of(roadVehicle));
		when(vehicleRepository.findAllById(List.of(VEHICLE_ID)))
				.thenReturn(List.of(vehicle(VEHICLE_ID, 2, VehicleStatus.AVAILABLE)));
		when(roadLegVehicleHorseRepository.findAllByRouteLegId(leg.getId()))
				.thenReturn(List.of(
						new RoadLegVehicleHorse(leg.getId(), roadVehicle.getId(), ORDER_HORSE_ID),
						new RoadLegVehicleHorse(leg.getId(), roadVehicle.getId(), SECOND_ORDER_HORSE_ID)));
		when(routePlanReviewRepository.maxSubmissionNo(plan.getId())).thenReturn(0);
		when(routePlanRepository.save(plan)).thenReturn(plan);

		RoutePlanResponse response = service.submitPlan(ORDER_ID);

		assertThat(response.status()).isEqualTo(RoutePlanStatus.PENDING_LM_REVIEW);
		ArgumentCaptor<RoutePlanReview> review = ArgumentCaptor.forClass(RoutePlanReview.class);
		verify(routePlanReviewRepository).save(review.capture());
		assertThat(review.getValue().getRoutePlanId()).isEqualTo(plan.getId());
		assertThat(review.getValue().getSubmissionNo()).isEqualTo(1);
		assertThat(review.getValue().getDecision()).isEqualTo(RoutePlanReviewDecision.PENDING);
	}

	@Test
	void addsAirLegConfigurationAndReturnsReadBackFields() {
		RoutePlan plan = routePlan();
		when(routePlanRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(plan));
		when(routeLegRepository.save(any(RouteLeg.class))).thenAnswer(invocation -> invocation.getArgument(0));

		RouteLegResponse response = service.addLeg(ORDER_ID, airLegRequest(1, "Stable A", "Destination Stable", 2));

		assertThat(response.legType()).isEqualTo(RouteLegType.AIR);
		assertThat(response.airProviderName()).isEqualTo("Demo Air");
		assertThat(response.airReference()).isEqualTo("DA-1");
		assertThat(response.airCapacityHorses()).isEqualTo(2);
	}

	@Test
	void rejectsAirLegMissingRequiredFieldsOnAdd() {
		RoutePlan plan = routePlan();
		when(routePlanRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(plan));

		UpsertRouteLegRequest request = new UpsertRouteLegRequest(
				1,
				RouteLegType.AIR,
				"Stable A",
				"Destination Stable",
				LocalDateTime.of(2026, 10, 12, 8, 0),
				LocalDateTime.of(2026, 10, 12, 10, 0),
				null,
				"DA-1",
				2,
				null,
				null);

		assertThatThrownBy(() -> service.addLeg(ORDER_ID, request))
				.isInstanceOf(RoutePlanValidationException.class)
				.hasMessageContaining("AIR route legs require");
	}

	@Test
	void validationReportsInsufficientAirCapacity() {
		RoutePlan plan = routePlan();
		RouteLeg leg = airLeg(plan.getId(), 1, "Stable A", "Destination Stable", 1);

		when(routePlanRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(plan));
		when(routeLegRepository.findAllByRoutePlanIdOrderBySequenceNoAsc(plan.getId()))
				.thenReturn(List.of(leg));

		RoutePlanValidationResponse response = service.validatePlan(ORDER_ID);

		assertThat(response.valid()).isFalse();
		assertThat(response.issues())
				.extracting(RoutePlanValidationIssueResponse::code)
				.contains("AIR_CAPACITY_INSUFFICIENT");
	}

	@Test
	void submitsValidAirPlanForLmReview() {
		RoutePlan plan = routePlan();
		RouteLeg leg = airLeg(plan.getId(), 1, "Stable A", "Destination Stable", 2);

		when(routePlanRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(plan));
		when(routeLegRepository.findAllByRoutePlanIdOrderBySequenceNoAsc(plan.getId()))
				.thenReturn(List.of(leg));
		when(routePlanReviewRepository.maxSubmissionNo(plan.getId())).thenReturn(0);
		when(routePlanRepository.save(plan)).thenReturn(plan);

		RoutePlanResponse response = service.submitPlan(ORDER_ID);

		assertThat(response.status()).isEqualTo(RoutePlanStatus.PENDING_LM_REVIEW);
	}

	@Test
	void lmInboxListsPendingRoutePlanReviews() {
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.LOGISTICS_MANAGER);
		RoutePlan plan = routePlan();
		plan.submitForReview();
		RoutePlanReview review = new RoutePlanReview(plan.getId(), 2, FRC_ID);

		when(routePlanReviewRepository.findAllByDecisionOrderBySubmittedAtAsc(RoutePlanReviewDecision.PENDING))
				.thenReturn(List.of(review));
		when(routePlanRepository.findAllById(List.of(plan.getId()))).thenReturn(List.of(plan));

		List<LmRoutePlanReviewInboxResponse> response = service.listLmReviewInbox();

		assertThat(response).hasSize(1);
		assertThat(response.get(0).routePlanId()).isEqualTo(plan.getId());
		assertThat(response.get(0).transportOrderId()).isEqualTo(ORDER_ID);
		assertThat(response.get(0).submissionNo()).isEqualTo(2);
	}

	@Test
	void lmReturnRequiresReason() {
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.LOGISTICS_MANAGER);

		assertThatThrownBy(() -> service.returnRoutePlan(ORDER_ID, new ReturnRoutePlanRequest(" ")))
				.isInstanceOf(RoutePlanValidationException.class)
				.hasMessageContaining("reason");
	}

	@Test
	void lmReturnsPendingRoutePlanToFrcWithReason() {
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.LOGISTICS_MANAGER);
		RoutePlan plan = routePlan();
		plan.submitForReview();
		RoutePlanReview review = new RoutePlanReview(plan.getId(), 1, FRC_ID);

		when(routePlanRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(plan));
		when(routePlanReviewRepository.findFirstByRoutePlanIdAndDecisionOrderBySubmissionNoDesc(
				plan.getId(), RoutePlanReviewDecision.PENDING)).thenReturn(Optional.of(review));
		when(routePlanRepository.save(plan)).thenReturn(plan);
		when(routePlanReviewRepository.save(review)).thenReturn(review);

		LmRoutePlanReviewDetailResponse response =
				service.returnRoutePlan(ORDER_ID, new ReturnRoutePlanRequest("Need route correction"));

		assertThat(response.routePlan().status()).isEqualTo(RoutePlanStatus.RETURNED);
		assertThat(response.review().decision()).isEqualTo(RoutePlanReviewDecision.RETURNED);
		assertThat(response.review().returnReason()).isEqualTo("Need route correction");
	}

	@Test
	void lmConfirmRevalidatesAssignsStaffAndMarksOrderReadyToShip() {
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.LOGISTICS_MANAGER);
		when(currentUserProvider.getCurrentUserId()).thenReturn(LM_ID);
		RoutePlan plan = routePlan();
		plan.submitForReview();
		RoutePlanReview review = new RoutePlanReview(plan.getId(), 1, FRC_ID);
		RouteLeg leg = airLeg(plan.getId(), 1, "Stable A", "Destination Stable", 2);
		TransportOrder order = order(ORDER_HORSE_ID, SECOND_ORDER_HORSE_ID);

		when(orderRepository.findByIdForUpdate(ORDER_ID))
				.thenReturn(Optional.of(order));
		when(routePlanRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(plan));
		when(routePlanReviewRepository.findFirstByRoutePlanIdAndDecisionOrderBySubmissionNoDesc(
				plan.getId(), RoutePlanReviewDecision.PENDING)).thenReturn(Optional.of(review));
		when(routeLegRepository.findAllByRoutePlanIdOrderBySequenceNoAsc(plan.getId()))
				.thenReturn(List.of(leg));
		when(routePlanRepository.save(plan)).thenReturn(plan);
		when(routePlanReviewRepository.save(review)).thenReturn(review);

		LmRoutePlanReviewDetailResponse response = service.confirmRoutePlan(ORDER_ID);

		assertThat(response.routePlan().status()).isEqualTo(RoutePlanStatus.APPROVED);
		assertThat(response.routePlan().lockedAt()).isNotNull();
		assertThat(response.routePlan().approvedAt()).isNotNull();
		assertThat(response.review().decision()).isEqualTo(RoutePlanReviewDecision.CONFIRMED);
		assertThat(response.orderStatus()).isEqualTo(OrderStatus.READY_TO_SHIP);
		assertThat(order.getStatus()).isEqualTo(OrderStatus.READY_TO_SHIP);
		assertThat(leg.getStatus()).isEqualTo(RouteLegStatus.READY);
		verify(executionStaffingService).assignStaff(plan, List.of(leg));
		verify(statusAuditRecorder).recordUserTransition(AuditEntityType.ROUTE_LEG, leg.getId(),
				RouteLegStatus.PLANNED.name(), RouteLegStatus.READY.name(), LM_ID, null);
		verify(statusAuditRecorder).recordSystemTransition(AuditEntityType.TRANSPORT_ORDER,
				ORDER_ID, OrderStatus.APPROVED.name(), OrderStatus.READY_TO_SHIP.name());
	}

	@Test
	void vehicleCandidatesReturnSelectabilityReasons() {
		RoutePlan plan = routePlan();
		RouteLeg leg = roadLeg(plan.getId(), 1, "Stable A", "Destination Stable");
		Vehicle available = vehicle(VEHICLE_ID, 2, VehicleStatus.AVAILABLE);
		Vehicle maintenance = vehicle(SECOND_VEHICLE_ID, 2, VehicleStatus.MAINTENANCE);

		when(routePlanRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(plan));
		when(routeLegRepository.findById(leg.getId())).thenReturn(Optional.of(leg));
		when(vehicleRepository.findAllByOrderByPlateNumberAsc()).thenReturn(List.of(available, maintenance));
		when(roadLegVehicleRepository.findOverlappingAllocations(
				List.of(VEHICLE_ID, SECOND_VEHICLE_ID),
				leg.getId(),
				leg.getPlannedDepartureAt(),
				leg.getPlannedArrivalAt()))
				.thenReturn(List.of(new RoadLegVehicle(UUID.randomUUID(), VEHICLE_ID)));

		List<VehicleCandidateResponse> response = service.listVehicleCandidates(ORDER_ID, leg.getId());

		assertThat(response).hasSize(2);
		assertThat(response.get(0).selectable()).isFalse();
		assertThat(response.get(0).reasons()).containsExactly("OVERLAPPING_ROUTE_LEG");
		assertThat(response.get(1).selectable()).isFalse();
		assertThat(response.get(1).reasons()).containsExactly("MAINTENANCE");
	}

	@Test
	void rejectsDuplicateHorseAllocation() {
		RoutePlan plan = routePlan();
		RouteLeg leg = roadLeg(plan.getId(), 1, "Stable A", "Destination Stable");

		when(routePlanRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(plan));
		when(routeLegRepository.findById(leg.getId())).thenReturn(Optional.of(leg));
		when(vehicleRepository.findAllById(any()))
				.thenReturn(List.of(vehicle(VEHICLE_ID, 2, VehicleStatus.AVAILABLE)));

		RoadVehicleAllocationRequest request = new RoadVehicleAllocationRequest(List.of(
				new RoadVehicleAllocationRequest.VehicleHorseAllocationRequest(
						VEHICLE_ID, List.of(ORDER_HORSE_ID, ORDER_HORSE_ID))));

		assertThatThrownBy(() -> service.allocateRoadVehicles(ORDER_ID, leg.getId(), request))
				.isInstanceOf(RoutePlanValidationException.class)
				.hasMessageContaining("duplicate Horse");
	}

	@Test
	void rejectsForeignHorseAllocation() {
		RoutePlan plan = routePlan();
		RouteLeg leg = roadLeg(plan.getId(), 1, "Stable A", "Destination Stable");

		when(routePlanRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(plan));
		when(routeLegRepository.findById(leg.getId())).thenReturn(Optional.of(leg));
		when(vehicleRepository.findAllById(any()))
				.thenReturn(List.of(vehicle(VEHICLE_ID, 2, VehicleStatus.AVAILABLE)));

		RoadVehicleAllocationRequest request = new RoadVehicleAllocationRequest(List.of(
				new RoadVehicleAllocationRequest.VehicleHorseAllocationRequest(
						VEHICLE_ID, List.of(ORDER_HORSE_ID, FOREIGN_ORDER_HORSE_ID))));

		assertThatThrownBy(() -> service.allocateRoadVehicles(ORDER_ID, leg.getId(), request))
				.isInstanceOf(RoutePlanValidationException.class)
				.hasMessageContaining("foreign Horse");
	}

	@Test
	void rejectsCapacityExceededAllocation() {
		RoutePlan plan = routePlan();
		RouteLeg leg = roadLeg(plan.getId(), 1, "Stable A", "Destination Stable");

		when(routePlanRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(plan));
		when(routeLegRepository.findById(leg.getId())).thenReturn(Optional.of(leg));
		when(vehicleRepository.findAllById(any()))
				.thenReturn(List.of(vehicle(VEHICLE_ID, 1, VehicleStatus.AVAILABLE)));

		RoadVehicleAllocationRequest request = new RoadVehicleAllocationRequest(List.of(
				new RoadVehicleAllocationRequest.VehicleHorseAllocationRequest(
						VEHICLE_ID, List.of(ORDER_HORSE_ID, SECOND_ORDER_HORSE_ID))));

		assertThatThrownBy(() -> service.allocateRoadVehicles(ORDER_ID, leg.getId(), request))
				.isInstanceOf(RoutePlanValidationException.class)
				.hasMessageContaining("capacity");
	}

	@Test
	void rejectsOverlappingVehicleAllocation() {
		RoutePlan plan = routePlan();
		RouteLeg leg = roadLeg(plan.getId(), 1, "Stable A", "Destination Stable");

		when(routePlanRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(plan));
		when(routeLegRepository.findById(leg.getId())).thenReturn(Optional.of(leg));
		when(vehicleRepository.findAllById(any()))
				.thenReturn(List.of(vehicle(VEHICLE_ID, 2, VehicleStatus.AVAILABLE)));
		when(roadLegVehicleRepository.findOverlappingAllocations(any(), any(), any(), any()))
				.thenReturn(List.of(new RoadLegVehicle(UUID.randomUUID(), VEHICLE_ID)));

		RoadVehicleAllocationRequest request = new RoadVehicleAllocationRequest(List.of(
				new RoadVehicleAllocationRequest.VehicleHorseAllocationRequest(
						VEHICLE_ID, List.of(ORDER_HORSE_ID, SECOND_ORDER_HORSE_ID))));

		assertThatThrownBy(() -> service.allocateRoadVehicles(ORDER_ID, leg.getId(), request))
				.isInstanceOf(RoutePlanValidationException.class)
				.hasMessageContaining("overlaps");
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

	private RouteLeg airLeg(UUID planId, int sequenceNo, String origin, String destination, int capacity) {
		return new RouteLeg(
				planId,
				sequenceNo,
				RouteLegType.AIR,
				origin,
				destination,
				LocalDateTime.of(2026, 10, 12, 8 + sequenceNo, 0),
				LocalDateTime.of(2026, 10, 12, 9 + sequenceNo, 0),
				"Demo Air",
				"DA-" + sequenceNo,
				capacity,
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

	private UpsertRouteLegRequest airLegRequest(int sequenceNo, String origin, String destination, int capacity) {
		return new UpsertRouteLegRequest(
				sequenceNo,
				RouteLegType.AIR,
				origin,
				destination,
				LocalDateTime.of(2026, 10, 12, 8, 0),
				LocalDateTime.of(2026, 10, 12, 10, 0),
				"Demo Air",
				"DA-" + sequenceNo,
				capacity,
				null,
				null);
	}

	private Vehicle vehicle(UUID vehicleId, int capacity, VehicleStatus status) {
		Vehicle vehicle = new Vehicle("PLATE-" + vehicleId.toString().substring(0, 4),
				"Vehicle", "Trailer", capacity, status, null);
		ReflectionTestUtils.setField(vehicle, "id", vehicleId);
		return vehicle;
	}

	private TransportOrder order(UUID... orderHorseIds) {
		try {
			Constructor<TransportOrder> constructor = TransportOrder.class
					.getDeclaredConstructor(UUID.class, String.class);
			constructor.setAccessible(true);
			TransportOrder order = constructor.newInstance(CUSTOMER_ID, "ORD-test");
			ReflectionTestUtils.setField(order, "id", ORDER_ID);
			ReflectionTestUtils.setField(order, "status", OrderStatus.APPROVED);
			ReflectionTestUtils.setField(order, "originAddress", "Stable A");
			ReflectionTestUtils.setField(order, "destinationAddress", "Destination Stable");
			List<TransportOrderHorse> horses = new ArrayList<>();
			for (UUID orderHorseId : orderHorseIds) {
				horses.add(orderHorse(order, orderHorseId));
			}
			ReflectionTestUtils.setField(order, "horses", horses);
			return order;
		}
		catch (ReflectiveOperationException exception) {
			throw new IllegalStateException(exception);
		}
	}

	private TransportOrderHorse orderHorse(TransportOrder order, UUID orderHorseId) {
		try {
			Constructor<TransportOrderHorse> constructor = TransportOrderHorse.class
					.getDeclaredConstructor(TransportOrder.class, UUID.class);
			constructor.setAccessible(true);
			TransportOrderHorse orderHorse = constructor.newInstance(order, UUID.randomUUID());
			ReflectionTestUtils.setField(orderHorse, "id", orderHorseId);
			return orderHorse;
		}
		catch (ReflectiveOperationException exception) {
			throw new IllegalStateException(exception);
		}
	}
}
