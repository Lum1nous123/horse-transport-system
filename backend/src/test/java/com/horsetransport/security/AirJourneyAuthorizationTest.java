package com.horsetransport.security;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Optional;
import java.util.UUID;

import com.horsetransport.auth.JwtAuthenticationFilter;
import com.horsetransport.auth.JwtService;
import com.horsetransport.route.AirJourneyController;
import com.horsetransport.route.AirJourneyService;
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

@WebMvcTest(AirJourneyController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtService.class})
@TestPropertySource(properties = {
		"app.security.jwt.secret=01234567890123456789012345678901",
		"app.security.jwt.issuer=horse-transport-system",
		"app.security.jwt.expiration-minutes=60"
})
class AirJourneyAuthorizationTest {

	private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final UUID LEG_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

	@Autowired private MockMvc mockMvc;
	@Autowired private JwtService jwtService;
	@MockitoBean private AirJourneyService service;
	@MockitoBean private UserRepository userRepository;

	@Test
	void escortCanAccessAirExecution() throws Exception {
		mockMvc.perform(post(path()).header(HttpHeaders.AUTHORIZATION, token(UserRole.ESCORT)))
				.andExpect(status().isOk());
	}

	@Test
	void otherRolesCannotAccessAirExecution() throws Exception {
		for (UserRole role : new UserRole[] {UserRole.CUSTOMER, UserRole.LOGISTICS_MANAGER,
				UserRole.TRANSPORT_SPECIALIST, UserRole.FLEET_ROUTE_COORDINATOR, UserRole.DRIVER}) {
			mockMvc.perform(post(path()).header(HttpHeaders.AUTHORIZATION, token(role)))
					.andExpect(status().isForbidden());
		}
	}

	@Test
	void unauthenticatedAirExecutionIsUnauthorized() throws Exception {
		mockMvc.perform(post(path())).andExpect(status().isUnauthorized());
	}

	private String path() {
		return "/api/v1/air-executions/legs/" + LEG_ID + "/start";
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
