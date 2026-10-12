package com.horsetransport.route;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import com.horsetransport.user.UserStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ExecutionStaffingServiceTest {

	private static final UUID ORDER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final UUID FRC_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
	private static final UUID DRIVER_ONE_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
	private static final UUID DRIVER_TWO_ID = UUID.fromString("44444444-4444-4444-4444-444444444444");
	private static final UUID ESCORT_ONE_ID = UUID.fromString("55555555-5555-5555-5555-555555555555");
	private static final UUID ESCORT_TWO_ID = UUID.fromString("66666666-6666-6666-6666-666666666666");

	@Mock private UserRepository userRepository;
	@Mock private RoadLegVehicleRepository roadLegVehicleRepository;
	@Mock private RoadVehicleExecutionRepository roadVehicleExecutionRepository;
	@Mock private AirLegExecutionRepository airLegExecutionRepository;

	private final List<RoadVehicleExecution> savedRoadExecutions = new ArrayList<>();
	private final List<AirLegExecution> savedAirExecutions = new ArrayList<>();
	private ExecutionStaffingService service;

	@BeforeEach
	void setUp() {
		service = new ExecutionStaffingService(userRepository, roadLegVehicleRepository,
				roadVehicleExecutionRepository, airLegExecutionRepository);

		lenient().when(userRepository.findAllByRoleAndStatusOrderByIdAsc(
				UserRole.DRIVER, UserStatus.ACTIVE)).thenReturn(List.of(
						user(DRIVER_ONE_ID, UserRole.DRIVER), user(DRIVER_TWO_ID, UserRole.DRIVER)));
		lenient().when(userRepository.findAllByRoleAndStatusOrderByIdAsc(
				UserRole.ESCORT, UserStatus.ACTIVE)).thenReturn(List.of(
						user(ESCORT_ONE_ID, UserRole.ESCORT), user(ESCORT_TWO_ID, UserRole.ESCORT)));
		lenient().when(roadVehicleExecutionRepository.countByDriverIdAndStatusIn(any(), any())).thenReturn(0L);
		lenient().when(roadVehicleExecutionRepository.countByEscortIdAndStatusIn(any(), any())).thenReturn(0L);
		lenient().when(airLegExecutionRepository.countByEscortIdAndStatusIn(any(), any())).thenReturn(0L);
		lenient().when(roadVehicleExecutionRepository.findOverlappingDriverIds(any(), any(), any(), any()))
				.thenReturn(List.of());
		lenient().when(roadVehicleExecutionRepository.findOverlappingEscortIds(any(), any(), any(), any()))
				.thenReturn(List.of());
		lenient().when(airLegExecutionRepository.findOverlappingEscortIds(any(), any(), any(), any()))
				.thenReturn(List.of());
		lenient().when(roadVehicleExecutionRepository.findAllByRoadLegVehicleIdIn(any()))
				.thenAnswer(invocation -> List.copyOf(savedRoadExecutions));
		lenient().when(airLegExecutionRepository.findAllByRouteLegIdIn(any()))
				.thenAnswer(invocation -> List.copyOf(savedAirExecutions));
		lenient().when(roadVehicleExecutionRepository.saveAll(any()))
				.thenAnswer(invocation -> {
					savedRoadExecutions.addAll(invocation.getArgument(0));
					return invocation.getArgument(0);
				});
		lenient().when(airLegExecutionRepository.saveAll(any()))
				.thenAnswer(invocation -> {
					savedAirExecutions.addAll(invocation.getArgument(0));
					return invocation.getArgument(0);
				});
	}

	@Test
	void assignsOneDriverAndEscortPerRoadVehicleWithoutSameOperationDoubleBooking() {
		RoutePlan plan = approvedPlan();
		RouteLeg leg = roadLeg(plan.getId(), 1);
		RoadLegVehicle firstVehicle = new RoadLegVehicle(leg.getId(), UUID.randomUUID());
		RoadLegVehicle secondVehicle = new RoadLegVehicle(leg.getId(), UUID.randomUUID());
		when(roadLegVehicleRepository.findAllByRouteLegId(leg.getId()))
				.thenReturn(List.of(firstVehicle, secondVehicle));

		ExecutionStaffingResponse response = service.assignStaff(plan, List.of(leg));

		assertThat(response.roadVehicleExecutions()).hasSize(2);
		assertThat(response.roadVehicleExecutions())
				.extracting(ExecutionStaffingResponse.RoadVehicleExecutionResponse::driverId)
				.containsExactlyInAnyOrder(DRIVER_ONE_ID, DRIVER_TWO_ID);
		assertThat(response.roadVehicleExecutions())
				.extracting(ExecutionStaffingResponse.RoadVehicleExecutionResponse::escortId)
				.containsExactlyInAnyOrder(ESCORT_ONE_ID, ESCORT_TWO_ID);
		assertThat(response.airLegExecutions()).isEmpty();
	}

	@Test
	void assignsOnlyEscortForAirLeg() {
		RoutePlan plan = approvedPlan();
		RouteLeg leg = airLeg(plan.getId(), 1);

		ExecutionStaffingResponse response = service.assignStaff(plan, List.of(leg));

		assertThat(response.roadVehicleExecutions()).isEmpty();
		assertThat(response.airLegExecutions()).hasSize(1);
		assertThat(response.airLegExecutions().get(0).escortId()).isEqualTo(ESCORT_ONE_ID);
	}

	@Test
	void selectsLowestActiveCountBeforeStableId() {
		RoutePlan plan = approvedPlan();
		RouteLeg leg = roadLeg(plan.getId(), 1);
		RoadLegVehicle vehicle = new RoadLegVehicle(leg.getId(), UUID.randomUUID());
		when(roadLegVehicleRepository.findAllByRouteLegId(leg.getId())).thenReturn(List.of(vehicle));
		when(roadVehicleExecutionRepository.countByDriverIdAndStatusIn(eq(DRIVER_ONE_ID), any()))
				.thenReturn(2L);
		when(roadVehicleExecutionRepository.countByDriverIdAndStatusIn(eq(DRIVER_TWO_ID), any()))
				.thenReturn(0L);

		ExecutionStaffingResponse response = service.assignStaff(plan, List.of(leg));

		assertThat(response.roadVehicleExecutions().get(0).driverId()).isEqualTo(DRIVER_TWO_ID);
	}

	@Test
	void rejectsWhenNoEligibleDriverCanCoverAllRoadVehicles() {
		RoutePlan plan = approvedPlan();
		RouteLeg leg = roadLeg(plan.getId(), 1);
		RoadLegVehicle firstVehicle = new RoadLegVehicle(leg.getId(), UUID.randomUUID());
		RoadLegVehicle secondVehicle = new RoadLegVehicle(leg.getId(), UUID.randomUUID());
		when(userRepository.findAllByRoleAndStatusOrderByIdAsc(UserRole.DRIVER, UserStatus.ACTIVE))
				.thenReturn(List.of(user(DRIVER_ONE_ID, UserRole.DRIVER)));
		when(roadLegVehicleRepository.findAllByRouteLegId(leg.getId()))
				.thenReturn(List.of(firstVehicle, secondVehicle));

		assertThatThrownBy(() -> service.assignStaff(plan, List.of(leg)))
				.isInstanceOf(RoutePlanValidationException.class)
				.hasMessageContaining("Driver");
	}

	private RoutePlan approvedPlan() {
		RoutePlan plan = new RoutePlan(ORDER_ID, FRC_ID);
		plan.submitForReview();
		plan.approve();
		return plan;
	}

	private RouteLeg roadLeg(UUID planId, int sequenceNo) {
		return new RouteLeg(
				planId,
				sequenceNo,
				RouteLegType.ROAD,
				"Stable A",
				"Airport",
				LocalDateTime.of(2026, 10, 12, 8, 0),
				LocalDateTime.of(2026, 10, 12, 10, 0),
				null,
				null,
				null,
				null,
				null);
	}

	private RouteLeg airLeg(UUID planId, int sequenceNo) {
		return new RouteLeg(
				planId,
				sequenceNo,
				RouteLegType.AIR,
				"Airport",
				"Destination Stable",
				LocalDateTime.of(2026, 10, 12, 10, 0),
				LocalDateTime.of(2026, 10, 12, 12, 0),
				"Demo Air",
				"DA-" + sequenceNo,
				2,
				null,
				null);
	}

	private UserAccount user(UUID id, UserRole role) {
		UserAccount user = UserAccount.createActive("User " + id, id + "@test.local", null, "hash", role);
		ReflectionTestUtils.setField(user, "id", id);
		return user;
	}
}
