package com.horsetransport.payment;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.util.UUID;

import com.horsetransport.common.api.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class RemainingBalancePaymentControllerTest {

	private static final UUID ORDER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

	private RemainingBalancePaymentService service;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		service = org.mockito.Mockito.mock(RemainingBalancePaymentService.class);
		mockMvc = MockMvcBuilders.standaloneSetup(new RemainingBalancePaymentController(service))
				.setControllerAdvice(new GlobalExceptionHandler()).build();
	}

	@Test
	void exposesCheckoutAndStatusWithoutAcceptingClientAmountOrCurrency() throws Exception {
		when(service.createCheckout(ORDER_ID)).thenReturn(new RemainingBalanceCheckoutResponse(UUID.randomUUID(),
				UUID.randomUUID(), "cs_remaining", "https://checkout.stripe.test/remaining", PaymentStatus.PENDING));
		when(service.getRemainingBalance(ORDER_ID)).thenReturn(new RemainingBalanceResponse(ORDER_ID,
				new BigDecimal("750.00"), "USD", PaymentStatus.PENDING.name(), true, null));

		mockMvc.perform(post("/api/v1/orders/{id}/remaining-balance/checkout", ORDER_ID)
				.contentType(MediaType.APPLICATION_JSON).content("{\"amount\":1,\"currency\":\"EUR\"}"))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.paymentStatus").value("PENDING"));
		mockMvc.perform(get("/api/v1/orders/{id}/remaining-balance", ORDER_ID))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.amount").value(750.00))
				.andExpect(jsonPath("$.currency").value("USD"))
				.andExpect(jsonPath("$.checkoutEligible").value(true));
	}
}
