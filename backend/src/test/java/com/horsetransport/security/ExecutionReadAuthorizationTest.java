package com.horsetransport.security;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Optional;
import java.util.List;
import java.util.UUID;

import com.horsetransport.auth.JwtAuthenticationFilter;
import com.horsetransport.auth.JwtService;
import com.horsetransport.route.ExecutionReadController;
import com.horsetransport.route.ExecutionReadService;
import com.horsetransport.route.ExecutionReadComponents.HandoverProgress;
import com.horsetransport.route.ExecutionStatus;
import com.horsetransport.route.RoadExecutionReadResponse;
import com.horsetransport.route.RouteLegStatus;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import com.horsetransport.user.UserStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ExecutionReadController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtService.class})
@TestPropertySource(properties = {
		"app.security.jwt.secret=01234567890123456789012345678901",
		"app.security.jwt.issuer=horse-transport-system",
		"app.security.jwt.expiration-minutes=60"
})
class ExecutionReadAuthorizationTest {

	private static final UUID USER_ID = UUID.randomUUID();
	private static final UUID EXECUTION_ID = UUID.randomUUID();

	@Autowired private MockMvc mockMvc;
	@Autowired private JwtService jwtService;
	@MockitoBean private ExecutionReadService service;
	@MockitoBean private UserRepository userRepository;

	@Test
	void driverAndEscortCanReadRoadAssignments() throws Exception {
		for (UserRole role : new UserRole[] {UserRole.DRIVER, UserRole.ESCORT}) {
			mockMvc.perform(get("/api/v1/road-executions/assigned")
					.header(HttpHeaders.AUTHORIZATION, token(role)))
					.andExpect(status().isOk());
			mockMvc.perform(get("/api/v1/road-executions/{executionId}", EXECUTION_ID)
					.header(HttpHeaders.AUTHORIZATION, token(role)))
					.andExpect(status().isOk());
		}
	}

	@Test
	void onlyEscortCanReadAirAssignments() throws Exception {
		mockMvc.perform(get("/api/v1/air-executions/assigned")
				.header(HttpHeaders.AUTHORIZATION, token(UserRole.ESCORT)))
				.andExpect(status().isOk());
		mockMvc.perform(get("/api/v1/air-executions/{executionId}", EXECUTION_ID)
				.header(HttpHeaders.AUTHORIZATION, token(UserRole.DRIVER)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("FORBIDDEN"))
				.andExpect(jsonPath("$.message").value("Access is forbidden"))
				.andExpect(jsonPath("$.timestamp").isNotEmpty());
	}

	@Test
	void anonymousReadReturnsStableApiError() throws Exception {
		mockMvc.perform(get("/api/v1/road-executions/assigned"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
				.andExpect(jsonPath("$.message").value("Authentication is required"))
				.andExpect(jsonPath("$.timestamp").isNotEmpty());
	}

	@Test
	void unrelatedRolesCannotReadExecutionEndpoints() throws Exception {
		for (UserRole role : new UserRole[] {UserRole.CUSTOMER, UserRole.LOGISTICS_MANAGER,
				UserRole.TRANSPORT_SPECIALIST, UserRole.FLEET_ROUTE_COORDINATOR}) {
			mockMvc.perform(get("/api/v1/road-executions/assigned")
					.header(HttpHeaders.AUTHORIZATION, token(role)))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.code").value("FORBIDDEN"));
		}
	}

	@Test
	void roadQueueSerializesTheApprovedIdentifierNames() throws Exception {
		UUID roadVehicleId = UUID.randomUUID();
		UUID routeLegId = UUID.randomUUID();
		UUID orderId = UUID.randomUUID();
		RoadExecutionReadResponse.Summary summary = new RoadExecutionReadResponse.Summary(
				EXECUTION_ID, roadVehicleId, routeLegId, orderId, "ORD-S3",
				OrderStatus.IN_PROGRESS, 1, RouteLegStatus.IN_PROGRESS, true,
				"Origin", "Destination", null, "51H-123.45", "Horse Van", 1,
				ExecutionStatus.COMPLETED, 1, 0, null, true, false, true,
				new HandoverProgress(0, 1, RouteLegStatus.IN_PROGRESS, OrderStatus.IN_PROGRESS));
		when(service.assignedRoad()).thenReturn(new RoadExecutionReadResponse.Queue(List.of(summary)));

		mockMvc.perform(get("/api/v1/road-executions/assigned")
				.header(HttpHeaders.AUTHORIZATION, token(UserRole.ESCORT)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.executions[0].executionId").value(EXECUTION_ID.toString()))
				.andExpect(jsonPath("$.executions[0].roadLegVehicleId").value(roadVehicleId.toString()))
				.andExpect(jsonPath("$.executions[0].routeLegId").value(routeLegId.toString()))
				.andExpect(jsonPath("$.executions[0].isFinalLeg").value(true));
	}

	private String token(UserRole role) {
		UserAccount user = mock(UserAccount.class);
		when(user.getId()).thenReturn(USER_ID);
		when(user.getRole()).thenReturn(role);
		when(user.getStatus()).thenReturn(UserStatus.ACTIVE);
		when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
		return "Bearer " + jwtService.createToken(user);
	}
}
