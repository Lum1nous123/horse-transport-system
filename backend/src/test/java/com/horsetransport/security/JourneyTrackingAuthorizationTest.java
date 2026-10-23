package com.horsetransport.security;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.horsetransport.auth.JwtAuthenticationFilter;
import com.horsetransport.auth.JwtService;
import com.horsetransport.tracking.JourneyTrackingController;
import com.horsetransport.tracking.JourneyTrackingService;
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

@WebMvcTest(JourneyTrackingController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtService.class})
@TestPropertySource(properties = {
		"app.security.jwt.secret=01234567890123456789012345678901",
		"app.security.jwt.issuer=horse-transport-system",
		"app.security.jwt.expiration-minutes=60"
})
class JourneyTrackingAuthorizationTest {

	private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final UUID ORDER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

	@Autowired private MockMvc mockMvc;
	@Autowired private JwtService jwtService;
	@MockitoBean private JourneyTrackingService trackingService;
	@MockitoBean private UserRepository userRepository;

	@Test
	void customerAndLogisticsManagerCanUseTrackingEndpoint() throws Exception {
		for (UserRole role : List.of(UserRole.CUSTOMER, UserRole.LOGISTICS_MANAGER)) {
			mockMvc.perform(get("/api/v1/orders/{orderId}/tracking", ORDER_ID)
					.header(HttpHeaders.AUTHORIZATION, token(role)))
					.andExpect(status().isOk());
		}
	}

	@Test
	void unrelatedRolesAreForbidden() throws Exception {
		for (UserRole role : List.of(UserRole.TRANSPORT_SPECIALIST,
				UserRole.FLEET_ROUTE_COORDINATOR, UserRole.DRIVER, UserRole.ESCORT)) {
			mockMvc.perform(get("/api/v1/orders/{orderId}/tracking", ORDER_ID)
					.header(HttpHeaders.AUTHORIZATION, token(role)))
					.andExpect(status().isForbidden());
		}
	}

	@Test
	void unauthenticatedRequestIsUnauthorized() throws Exception {
		mockMvc.perform(get("/api/v1/orders/{orderId}/tracking", ORDER_ID))
				.andExpect(status().isUnauthorized());
	}

	private String token(UserRole role) {
		UserAccount account = mock(UserAccount.class);
		when(account.getId()).thenReturn(USER_ID);
		when(account.getRole()).thenReturn(role);
		when(account.getStatus()).thenReturn(UserStatus.ACTIVE);
		when(userRepository.findById(USER_ID)).thenReturn(Optional.of(account));
		return "Bearer " + jwtService.createToken(account);
	}
}
