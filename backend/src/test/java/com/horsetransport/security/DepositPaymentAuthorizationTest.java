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
import com.horsetransport.payment.DepositPaymentController;
import com.horsetransport.payment.DepositPaymentService;
import com.horsetransport.payment.StripeWebhookController;
import com.horsetransport.payment.StripeWebhookResponse;
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

@WebMvcTest({DepositPaymentController.class, StripeWebhookController.class})
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtService.class})
@TestPropertySource(properties = {
		"app.security.jwt.secret=01234567890123456789012345678901",
		"app.security.jwt.issuer=horse-transport-system",
		"app.security.jwt.expiration-minutes=60"
})
class DepositPaymentAuthorizationTest {

	private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final UUID ORDER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

	@Autowired private MockMvc mockMvc;
	@Autowired private JwtService jwtService;
	@MockitoBean private DepositPaymentService paymentService;
	@MockitoBean private UserRepository userRepository;

	@Test
	void customerCanStartCheckoutAndReadDeposit() throws Exception {
		String token = token(UserRole.CUSTOMER);
		mockMvc.perform(post(checkoutPath()).header(HttpHeaders.AUTHORIZATION, token))
				.andExpect(status().isCreated());
		mockMvc.perform(get(depositPath()).header(HttpHeaders.AUTHORIZATION, token))
				.andExpect(status().isOk());
	}

	@Test
	void otherRoleIsForbiddenAndUnauthenticatedRequestIsUnauthorized() throws Exception {
		String token = token(UserRole.LOGISTICS_MANAGER);
		mockMvc.perform(post(checkoutPath()).header(HttpHeaders.AUTHORIZATION, token))
				.andExpect(status().isForbidden());
		mockMvc.perform(get(depositPath()).header(HttpHeaders.AUTHORIZATION, token))
				.andExpect(status().isForbidden());
		mockMvc.perform(post(checkoutPath())).andExpect(status().isUnauthorized());
		mockMvc.perform(get(depositPath())).andExpect(status().isUnauthorized());
	}

	@Test
	void webhookIsPublicButStillDelegatesSignatureValidation() throws Exception {
		when(paymentService.handleWebhook("{}", "signed"))
				.thenReturn(new StripeWebhookResponse(true, false, false));
		mockMvc.perform(post("/api/v1/payments/stripe/webhook")
				.header("Stripe-Signature", "signed").content("{}"))
				.andExpect(status().isOk());
	}

	private String depositPath() {
		return "/api/v1/orders/" + ORDER_ID + "/deposit";
	}

	private String checkoutPath() {
		return depositPath() + "/checkout";
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
