package com.horsetransport.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DepositPaymentServiceTest {

	@Mock private DepositPaymentTransactionService transactionService;
	@Mock private StripePaymentGateway stripeGateway;
	@InjectMocks private DepositPaymentService service;

	@Test
	void checkoutUsesPreparedServerCommandAndAttachesProviderSession() {
		UUID orderId = UUID.randomUUID();
		Payment payment = new Payment(orderId, new BigDecimal("250.00"), "USD");
		PaymentAttempt attempt = new PaymentAttempt(payment.getId(), 1);
		StripeCheckoutCommand command = new StripeCheckoutCommand(orderId, payment.getAmount(), payment.getCurrency(),
				attempt.getIdempotencyKey(), Map.of("paymentId", payment.getId().toString()));
		PreparedDepositCheckout prepared = new PreparedDepositCheckout(payment, attempt, command);
		StripeCheckoutSession session = new StripeCheckoutSession("cs_1", "https://checkout.stripe.test/1", "pi_1");
		DepositCheckoutResponse expected = new DepositCheckoutResponse(payment.getId(), attempt.getId(), "cs_1",
				session.url(), PaymentStatus.PENDING);
		when(transactionService.prepareCheckout(orderId)).thenReturn(prepared);
		when(stripeGateway.createCheckout(command)).thenReturn(session);
		when(transactionService.attachCheckoutSession(payment.getId(), attempt.getId(), session)).thenReturn(expected);

		DepositCheckoutResponse response = service.createCheckout(orderId);

		assertThat(response).isEqualTo(expected);
		verify(stripeGateway).createCheckout(command);
	}

	@Test
	void signedWebhookIsParsedBeforeTransactionalProcessing() {
		StripeWebhookEvent event = new StripeWebhookEvent("evt_1", "checkout.session.completed",
				StripeEventKind.SUCCESS, "cs_1", "pi_1", 25000L, "usd", Map.of());
		when(stripeGateway.verifyAndParseWebhook("payload", "signature")).thenReturn(event);
		when(transactionService.processWebhook(event)).thenReturn(new WebhookProcessingResult(true, false, true));

		StripeWebhookResponse response = service.handleWebhook("payload", "signature");

		assertThat(response.orderApproved()).isTrue();
		verify(transactionService).processWebhook(event);
	}
}
