package com.horsetransport.security;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Optional;
import java.util.UUID;

import com.horsetransport.auth.JwtAuthenticationFilter;
import com.horsetransport.auth.JwtService;
import com.horsetransport.delivery.FinalHandoverController;
import com.horsetransport.delivery.FinalHandoverService;
import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import com.horsetransport.user.UserStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(FinalHandoverController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtService.class})
@TestPropertySource(properties = {
		"app.security.jwt.secret=01234567890123456789012345678901",
		"app.security.jwt.issuer=horse-transport-system",
		"app.security.jwt.expiration-minutes=60"
})
class FinalHandoverAuthorizationTest {

	private static final UUID USER_ID = UUID.randomUUID();
	private static final UUID SCOPE_ID = UUID.randomUUID();

	@Autowired private MockMvc mockMvc;
	@Autowired private JwtService jwtService;
	@MockitoBean private FinalHandoverService service;
	@MockitoBean private UserRepository userRepository;

	@Test
	void escortCanSubmitRoadAndAirProofOfDelivery() throws Exception {
		mockMvc.perform(request(roadPath()).header(HttpHeaders.AUTHORIZATION, token(UserRole.ESCORT)))
				.andExpect(status().isCreated());
		mockMvc.perform(request(airPath()).header(HttpHeaders.AUTHORIZATION, token(UserRole.ESCORT)))
				.andExpect(status().isCreated());
	}

	@Test
	void driverAndOtherRolesCannotSubmitProofOfDelivery() throws Exception {
		for (UserRole role : new UserRole[] {UserRole.CUSTOMER, UserRole.LOGISTICS_MANAGER,
				UserRole.TRANSPORT_SPECIALIST, UserRole.FLEET_ROUTE_COORDINATOR, UserRole.DRIVER}) {
			mockMvc.perform(request(roadPath()).header(HttpHeaders.AUTHORIZATION, token(role)))
					.andExpect(status().isForbidden());
		}
	}

	@Test
	void unauthenticatedProofOfDeliveryIsUnauthorized() throws Exception {
		mockMvc.perform(request(airPath())).andExpect(status().isUnauthorized());
	}

	private org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder request(String path) {
		return multipart(path).file(new MockMultipartFile("photo", "pod.jpg", "image/jpeg",
				new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff}))
				.param("recipientName", "Recipient");
	}

	private String roadPath() {
		return "/api/v1/road-executions/vehicles/" + SCOPE_ID + "/proof-of-delivery";
	}

	private String airPath() {
		return "/api/v1/air-executions/legs/" + SCOPE_ID + "/proof-of-delivery";
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
