package com.horsetransport.security;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.horsetransport.auth.JwtAuthenticationFilter;
import com.horsetransport.auth.JwtService;
import com.horsetransport.order.OrderStaffAssignmentController;
import com.horsetransport.order.OrderStaffAssignmentService;
import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(OrderStaffAssignmentController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtService.class})
@TestPropertySource(properties = {
		"app.security.jwt.secret=01234567890123456789012345678901",
		"app.security.jwt.issuer=horse-transport-system",
		"app.security.jwt.expiration-minutes=60"
})
class OrderStaffAssignmentAuthorizationTest {
	private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final UUID ORDER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

	@Autowired private MockMvc mockMvc;
	@Autowired private JwtService jwtService;
	@MockitoBean private OrderStaffAssignmentService assignmentService;
	@MockitoBean private UserRepository userRepository;

	@Test
	void logisticsManagerCanReadAssignmentInboxCandidatesAndReadback() throws Exception {
		String token = token(UserRole.LOGISTICS_MANAGER);
		when(assignmentService.findInbox()).thenReturn(List.of());
		when(assignmentService.findCandidates(ORDER_ID,
				com.horsetransport.order.OrderStaffRole.TRANSPORT_SPECIALIST)).thenReturn(List.of());
		when(assignmentService.findAssignments(ORDER_ID)).thenReturn(List.of());

		mockMvc.perform(get("/api/v1/orders/assignment-inbox").header(HttpHeaders.AUTHORIZATION, token))
				.andExpect(status().isOk());
		mockMvc.perform(get("/api/v1/orders/{id}/assignment-candidates", ORDER_ID)
				.queryParam("role", "TRANSPORT_SPECIALIST").header(HttpHeaders.AUTHORIZATION, token))
				.andExpect(status().isOk());
		mockMvc.perform(get("/api/v1/orders/{id}/staff-assignments", ORDER_ID)
				.header(HttpHeaders.AUTHORIZATION, token))
				.andExpect(status().isOk());
		mockMvc.perform(post("/api/v1/orders/{id}/staff-assignments", ORDER_ID)
				.header(HttpHeaders.AUTHORIZATION, token).contentType(MediaType.APPLICATION_JSON)
				.content("{\"transportSpecialistId\":\"33333333-3333-3333-3333-333333333333\","
						+ "\"fleetRouteCoordinatorId\":\"44444444-4444-4444-4444-444444444444\"}"))
				.andExpect(status().isCreated());
	}

	@Test
	void nonLogisticsManagerAndUnauthenticatedUsersCannotUseAssignmentApi() throws Exception {
		for (UserRole role : List.of(UserRole.CUSTOMER, UserRole.TRANSPORT_SPECIALIST,
				UserRole.FLEET_ROUTE_COORDINATOR, UserRole.DRIVER, UserRole.ESCORT)) {
			mockMvc.perform(get("/api/v1/orders/assignment-inbox")
					.header(HttpHeaders.AUTHORIZATION, token(role)))
					.andExpect(status().isForbidden());
		}
		mockMvc.perform(get("/api/v1/orders/assignment-inbox")).andExpect(status().isUnauthorized());
		mockMvc.perform(post("/api/v1/orders/{id}/staff-assignments", ORDER_ID)
				.header(HttpHeaders.AUTHORIZATION, token(UserRole.CUSTOMER))
				.contentType(MediaType.APPLICATION_JSON).content("{}"))
				.andExpect(status().isForbidden());
	}

	private String token(UserRole role) {
		UserAccount user = mock(UserAccount.class);
		when(user.getId()).thenReturn(USER_ID);
		when(user.getRole()).thenReturn(role);
		when(user.getStatus()).thenReturn(com.horsetransport.user.UserStatus.ACTIVE);
		when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
		return "Bearer " + jwtService.createToken(user);
	}
}
