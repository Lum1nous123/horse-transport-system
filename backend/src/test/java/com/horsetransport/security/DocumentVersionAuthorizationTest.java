package com.horsetransport.security;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Optional;
import java.util.UUID;

import com.horsetransport.auth.JwtAuthenticationFilter;
import com.horsetransport.auth.JwtService;
import com.horsetransport.document.DocumentVersionController;
import com.horsetransport.document.DocumentVersionService;
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

@WebMvcTest(DocumentVersionController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtService.class})
@TestPropertySource(properties = {
		"app.security.jwt.secret=01234567890123456789012345678901",
		"app.security.jwt.issuer=horse-transport-system",
		"app.security.jwt.expiration-minutes=60"
})
class DocumentVersionAuthorizationTest {

	private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final UUID DOCUMENT_ID = UUID.fromString("44444444-4444-4444-4444-444444444444");
	@Autowired private MockMvc mockMvc;
	@Autowired private JwtService jwtService;
	@MockitoBean private DocumentVersionService service;
	@MockitoBean private UserRepository userRepository;

	@Test
	void customerCanUseDocumentVersionEndpoints() throws Exception {
		String token = token(UserRole.CUSTOMER);
		mockMvc.perform(get(path()).header(HttpHeaders.AUTHORIZATION, token)).andExpect(status().isOk());
		mockMvc.perform(multipart(path()).file(file()).header(HttpHeaders.AUTHORIZATION, token))
				.andExpect(status().isCreated());
	}

	@Test
	void transportSpecialistAndOtherRolesAreForbidden() throws Exception {
		for (UserRole role : new UserRole[] {UserRole.TRANSPORT_SPECIALIST, UserRole.LOGISTICS_MANAGER,
				UserRole.FLEET_ROUTE_COORDINATOR, UserRole.DRIVER, UserRole.ESCORT}) {
			String token = token(role);
			mockMvc.perform(get(path()).header(HttpHeaders.AUTHORIZATION, token))
					.andExpect(status().isForbidden());
			mockMvc.perform(multipart(path()).file(file()).header(HttpHeaders.AUTHORIZATION, token))
					.andExpect(status().isForbidden());
		}
	}

	@Test
	void unauthenticatedRequestsAreUnauthorized() throws Exception {
		mockMvc.perform(get(path())).andExpect(status().isUnauthorized());
		mockMvc.perform(multipart(path()).file(file())).andExpect(status().isUnauthorized());
	}

	private String path() { return "/api/v1/documents/" + DOCUMENT_ID + "/versions"; }
	private MockMultipartFile file() {
		return new MockMultipartFile("file", "document.pdf", "application/pdf", new byte[] {1});
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
