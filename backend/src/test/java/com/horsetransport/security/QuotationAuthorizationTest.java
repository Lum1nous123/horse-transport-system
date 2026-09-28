package com.horsetransport.security;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Optional;
import java.util.UUID;

import com.horsetransport.auth.JwtAuthenticationFilter;
import com.horsetransport.auth.JwtService;
import com.horsetransport.quotation.QuotationController;
import com.horsetransport.quotation.QuotationService;
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

@WebMvcTest(QuotationController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtService.class})
@TestPropertySource(properties = {
		"app.security.jwt.secret=01234567890123456789012345678901",
		"app.security.jwt.issuer=horse-transport-system",
		"app.security.jwt.expiration-minutes=60"
})
class QuotationAuthorizationTest {

	private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final UUID ORDER_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");

	@Autowired private MockMvc mockMvc;
	@Autowired private JwtService jwtService;
	@MockitoBean private QuotationService quotationService;
	@MockitoBean private UserRepository userRepository;

	@Test
	void logisticsManagerCanCreateEditGetAndSend() throws Exception {
		String token = token(UserRole.LOGISTICS_MANAGER);

		mockMvc.perform(post(path()).header(HttpHeaders.AUTHORIZATION, token))
				.andExpect(status().isCreated());
		mockMvc.perform(put(path()).header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON).content("{}"))
				.andExpect(status().isOk());
		mockMvc.perform(get(path()).header(HttpHeaders.AUTHORIZATION, token))
				.andExpect(status().isOk());
		mockMvc.perform(post(path() + "/send").header(HttpHeaders.AUTHORIZATION, token))
				.andExpect(status().isOk());
	}

	@Test
	void customerCanOnlyGet() throws Exception {
		String token = token(UserRole.CUSTOMER);

		mockMvc.perform(get(path()).header(HttpHeaders.AUTHORIZATION, token))
				.andExpect(status().isOk());
		mockMvc.perform(post(path()).header(HttpHeaders.AUTHORIZATION, token))
				.andExpect(status().isForbidden());
		mockMvc.perform(put(path()).header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON).content("{}"))
				.andExpect(status().isForbidden());
		mockMvc.perform(post(path() + "/send").header(HttpHeaders.AUTHORIZATION, token))
				.andExpect(status().isForbidden());
	}

	@Test
	void otherRoleIsForbidden() throws Exception {
		String token = token(UserRole.TRANSPORT_SPECIALIST);

		mockMvc.perform(get(path()).header(HttpHeaders.AUTHORIZATION, token))
				.andExpect(status().isForbidden());
		mockMvc.perform(post(path()).header(HttpHeaders.AUTHORIZATION, token))
				.andExpect(status().isForbidden());
		mockMvc.perform(put(path()).header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON).content("{}"))
				.andExpect(status().isForbidden());
		mockMvc.perform(post(path() + "/send").header(HttpHeaders.AUTHORIZATION, token))
				.andExpect(status().isForbidden());
	}

	@Test
	void unauthenticatedRequestsAreUnauthorized() throws Exception {
		mockMvc.perform(get(path())).andExpect(status().isUnauthorized());
		mockMvc.perform(post(path())).andExpect(status().isUnauthorized());
		mockMvc.perform(put(path()).contentType(MediaType.APPLICATION_JSON).content("{}"))
				.andExpect(status().isUnauthorized());
		mockMvc.perform(post(path() + "/send")).andExpect(status().isUnauthorized());
	}

	private String path() {
		return "/api/v1/orders/" + ORDER_ID + "/quotation";
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
