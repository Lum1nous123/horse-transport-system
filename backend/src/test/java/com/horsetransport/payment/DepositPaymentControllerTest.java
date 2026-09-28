package com.horsetransport.payment;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import com.horsetransport.common.api.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class DepositPaymentControllerTest {

	private static final UUID ORDER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
	private DepositPaymentService service;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		service = org.mockito.Mockito.mock(DepositPaymentService.class);
		mockMvc = MockMvcBuilders.standaloneSetup(
				new DepositPaymentController(service), new StripeWebhookController(service))
				.setControllerAdvice(new GlobalExceptionHandler()).build();
	}

	@Test
	void exposesCheckoutAndStatusWithoutAcceptingClientAmountOrCurrency() throws Exception {
		when(service.createCheckout(ORDER_ID)).thenReturn(new DepositCheckoutResponse(UUID.randomUUID(),
				UUID.randomUUID(), "cs_1", "https://checkout.stripe.test/1", PaymentStatus.PENDING));
		when(service.getDeposit(ORDER_ID)).thenReturn(new DepositPaymentResponse(UUID.randomUUID(), ORDER_ID,
				PaymentType.DEPOSIT, new BigDecimal("250.00"), "USD", PaymentStatus.PENDING, null, null));

		mockMvc.perform(post("/api/v1/orders/{id}/deposit/checkout", ORDER_ID)
				.contentType(MediaType.APPLICATION_JSON).content("{\"amount\":1,\"currency\":\"EUR\"}"))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.paymentStatus").value("PENDING"));
		mockMvc.perform(get("/api/v1/orders/{id}/deposit", ORDER_ID))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.amount").value(250.00))
				.andExpect(jsonPath("$.currency").value("USD"));
	}

	@Test
	void acceptsWebhookAndMapsInvalidSignatureToCommonErrorEnvelope() throws Exception {
		when(service.handleWebhook("{}", "valid")).thenReturn(new StripeWebhookResponse(true, false, true));
		when(service.handleWebhook(any(), org.mockito.ArgumentMatchers.eq("invalid")))
				.thenThrow(new InvalidStripeWebhookException("Stripe webhook signature is invalid", null));
		when(service.handleWebhook(any(), org.mockito.ArgumentMatchers.isNull()))
				.thenThrow(new InvalidStripeWebhookException("Stripe-Signature header is required", null));

		mockMvc.perform(post("/api/v1/payments/stripe/webhook")
				.header("Stripe-Signature", "valid").contentType(MediaType.APPLICATION_JSON).content("{}"))
				.andExpect(status().isOk()).andExpect(jsonPath("$.orderApproved").value(true));
		mockMvc.perform(post("/api/v1/payments/stripe/webhook")
				.header("Stripe-Signature", "invalid").contentType(MediaType.APPLICATION_JSON).content("{}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_STRIPE_WEBHOOK"))
				.andExpect(jsonPath("$.timestamp").exists());
		mockMvc.perform(post("/api/v1/payments/stripe/webhook")
				.contentType(MediaType.APPLICATION_JSON).content("{}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_STRIPE_WEBHOOK"));
	}
}
