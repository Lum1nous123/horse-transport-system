package com.horsetransport.security;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Optional;
import java.util.UUID;

import com.horsetransport.auth.JwtAuthenticationFilter;
import com.horsetransport.auth.JwtService;
import com.horsetransport.payment.RemainingBalancePaymentController;
import com.horsetransport.payment.RemainingBalancePaymentService;
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

@WebMvcTest(RemainingBalancePaymentController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtService.class})
@TestPropertySource(properties = {
		"app.security.jwt.secret=01234567890123456789012345678901",
		"app.security.jwt.issuer=horse-transport-system",
		"app.security.jwt.expiration-minutes=60"
})
class RemainingBalancePaymentAuthorizationTest {

	private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final UUID ORDER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

	@Autowired private MockMvc mockMvc;
	@Autowired private JwtService jwtService;
	@MockitoBean private RemainingBalancePaymentService paymentService;
	@MockitoBean private UserRepository userRepository;

	@Test
	void customerCanStartCheckoutAndReadRemainingBalance() throws Exception {
		String token = token(UserRole.CUSTOMER);

		mockMvc.perform(post(checkoutPath()).header(HttpHeaders.AUTHORIZATION, token))
				.andExpect(status().isCreated());
		mockMvc.perform(get(remainingBalancePath()).header(HttpHeaders.AUTHORIZATION, token))
				.andExpect(status().isOk());
	}

	@Test
	void otherRolesAreForbiddenAndUnauthenticatedRequestIsUnauthorized() throws Exception {
		for (UserRole role : UserRole.values()) {
			if (role == UserRole.CUSTOMER) continue;
			String token = token(role);
			mockMvc.perform(post(checkoutPath()).header(HttpHeaders.AUTHORIZATION, token))
					.andExpect(status().isForbidden());
			mockMvc.perform(get(remainingBalancePath()).header(HttpHeaders.AUTHORIZATION, token))
					.andExpect(status().isForbidden());
		}

		mockMvc.perform(post(checkoutPath())).andExpect(status().isUnauthorized());
		mockMvc.perform(get(remainingBalancePath())).andExpect(status().isUnauthorized());
	}

	private String remainingBalancePath() {
		return "/api/v1/orders/" + ORDER_ID + "/remaining-balance";
	}

	private String checkoutPath() {
		return remainingBalancePath() + "/checkout";
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
