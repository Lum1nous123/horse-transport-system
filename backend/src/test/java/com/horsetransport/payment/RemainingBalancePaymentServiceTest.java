package com.horsetransport.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class RemainingBalancePaymentServiceTest {

	private static final UUID ORDER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

	private RemainingBalancePaymentTransactionService transactionService;
	private StripePaymentGateway stripeGateway;
	private RemainingBalancePaymentService service;

	@BeforeEach
	void setUp() {
		transactionService = org.mockito.Mockito.mock(RemainingBalancePaymentTransactionService.class);
		stripeGateway = org.mockito.Mockito.mock(StripePaymentGateway.class);
		service = new RemainingBalancePaymentService(transactionService, stripeGateway);
	}

	@Test
	void checkoutUsesPreparedServerSideRemainingBalanceCommand() {
		Payment payment = Payment.remainingBalance(ORDER_ID, new BigDecimal("750.00"), "USD");
		PaymentAttempt attempt = new PaymentAttempt(payment.getId(), PaymentType.REMAINING_BALANCE, 1);
		StripeCheckoutCommand command = new StripeCheckoutCommand(ORDER_ID, payment.getAmount(), payment.getCurrency(),
				attempt.getIdempotencyKey(), Map.of("paymentType", PaymentType.REMAINING_BALANCE.name()));
		when(transactionService.prepareCheckout(ORDER_ID))
				.thenReturn(new PreparedRemainingBalanceCheckout(payment, attempt, command));
		when(stripeGateway.createCheckout(command)).thenReturn(
				new StripeCheckoutSession("cs_remaining", "https://checkout.stripe.test/remaining", "pi_remaining"));
		when(transactionService.attachCheckoutSession(payment.getId(), attempt.getId(),
				new StripeCheckoutSession("cs_remaining", "https://checkout.stripe.test/remaining", "pi_remaining")))
				.thenReturn(new RemainingBalanceCheckoutResponse(payment.getId(), attempt.getId(), "cs_remaining",
						"https://checkout.stripe.test/remaining", PaymentStatus.PENDING));

		RemainingBalanceCheckoutResponse response = service.createCheckout(ORDER_ID);

		assertThat(response.paymentStatus()).isEqualTo(PaymentStatus.PENDING);
		ArgumentCaptor<StripeCheckoutCommand> commandCaptor = ArgumentCaptor.forClass(StripeCheckoutCommand.class);
		verify(stripeGateway).createCheckout(commandCaptor.capture());
		assertThat(commandCaptor.getValue().metadata())
				.containsEntry("paymentType", PaymentType.REMAINING_BALANCE.name());
	}
}
