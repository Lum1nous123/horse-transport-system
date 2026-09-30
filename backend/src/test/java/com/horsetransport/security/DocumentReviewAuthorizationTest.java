package com.horsetransport.security;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Optional;
import java.util.UUID;

import com.horsetransport.auth.JwtAuthenticationFilter;
import com.horsetransport.auth.JwtService;
import com.horsetransport.document.DocumentReviewController;
import com.horsetransport.document.DocumentReviewService;
import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import com.horsetransport.user.UserStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(DocumentReviewController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtService.class})
@TestPropertySource(properties = {
		"app.security.jwt.secret=01234567890123456789012345678901",
		"app.security.jwt.issuer=horse-transport-system",
		"app.security.jwt.expiration-minutes=60"
})
class DocumentReviewAuthorizationTest {

	private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final UUID DOCUMENT_ID = UUID.fromString("44444444-4444-4444-4444-444444444444");
	private static final UUID VERSION_ID = UUID.fromString("55555555-5555-5555-5555-555555555555");
	@Autowired private MockMvc mockMvc;
	@Autowired private JwtService jwtService;
	@MockitoBean private DocumentReviewService service;
	@MockitoBean private UserRepository userRepository;

	@Test
	void transportSpecialistCanApproveAndReject() throws Exception {
		String token = token(UserRole.TRANSPORT_SPECIALIST);
		mockMvc.perform(post(path("approve")).header(HttpHeaders.AUTHORIZATION, token))
				.andExpect(status().isOk());
		mockMvc.perform(post(path("reject")).header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON).content(validBody()))
				.andExpect(status().isOk());
	}

	@Test
	void customerAndOtherRolesCannotReview() throws Exception {
		for (UserRole role : new UserRole[] {UserRole.CUSTOMER, UserRole.LOGISTICS_MANAGER,
				UserRole.FLEET_ROUTE_COORDINATOR, UserRole.DRIVER, UserRole.ESCORT}) {
			String token = token(role);
			mockMvc.perform(post(path("approve")).header(HttpHeaders.AUTHORIZATION, token))
					.andExpect(status().isForbidden());
			mockMvc.perform(post(path("reject")).header(HttpHeaders.AUTHORIZATION, token)
					.contentType(MediaType.APPLICATION_JSON).content(validBody()))
					.andExpect(status().isForbidden());
		}
	}

	@Test
	void unauthenticatedReviewIsUnauthorized() throws Exception {
		mockMvc.perform(post(path("approve"))).andExpect(status().isUnauthorized());
		mockMvc.perform(post(path("reject")).contentType(MediaType.APPLICATION_JSON).content(validBody()))
				.andExpect(status().isUnauthorized());
	}

	private String path(String action) {
		return "/api/v1/documents/" + DOCUMENT_ID + "/versions/" + VERSION_ID + "/" + action;
	}

	private String validBody() { return "{\"rejectionReason\":\"Reason\"}"; }

	private String token(UserRole role) {
		UserAccount user = mock(UserAccount.class);
		when(user.getId()).thenReturn(USER_ID);
		when(user.getRole()).thenReturn(role);
		when(user.getStatus()).thenReturn(UserStatus.ACTIVE);
		when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
		return "Bearer " + jwtService.createToken(user);
	}
}
