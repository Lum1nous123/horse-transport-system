package com.horsetransport.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import com.horsetransport.notification.NotificationService;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DepositRefundServiceTest {
	@Mock private DepositRefundRepository refunds;
	@Mock private PaymentRepository payments;
	@Mock private PaymentAttemptRepository attempts;
	@Mock private PaymentProviderEventRepository events;
	@Mock private TransportOrderRepository orders;
	@Mock private StripePaymentGateway stripe;
	@Mock private NotificationService notifications;
	private final Clock clock = Clock.fixed(Instant.parse("2026-10-04T10:00:00Z"), ZoneOffset.UTC);
	private DepositRefundService service;

	@BeforeEach
	void setUp() {
		service = new DepositRefundService(refunds, payments, attempts, events, orders, stripe, notifications, clock);
	}

	@Test
	void fullRefundMarksPaymentRefundedAndCreatesOneSuccessNotification() {
		UUID orderId = UUID.randomUUID();
		TransportOrder order = org.mockito.Mockito.mock(TransportOrder.class);
		when(order.getCustomerId()).thenReturn(UUID.randomUUID());
		when(order.getId()).thenReturn(orderId);
		Payment payment = paidPayment(orderId);
		PaymentAttempt attempt = successfulAttempt(payment.getId());
		DepositRefund refund = new DepositRefund(payment.getId(), "deadline-refund-" + payment.getId(),
				java.time.LocalDateTime.now(clock));
		when(refunds.findByIdForUpdate(refund.getId())).thenReturn(Optional.of(refund));
		when(payments.findByIdForUpdate(payment.getId())).thenReturn(Optional.of(payment));
		when(attempts.findFirstByPaymentIdOrderByAttemptNoDesc(payment.getId())).thenReturn(Optional.of(attempt));
		when(stripe.createRefund(any())).thenReturn(new StripeRefundResult("re_1", "pi_1", 25000L, "usd", "succeeded"));
		when(orders.findById(orderId)).thenReturn(Optional.of(order));

		service.processOne(refund.getId());

		assertThat(payment.getStatus()).isEqualTo(PaymentStatus.REFUNDED);
		assertThat(refund.getProviderStatus()).isEqualTo("succeeded");
		assertThat(refund.getCompletedAt()).isNotNull();
		verify(stripe).createRefund(org.mockito.ArgumentMatchers.argThat(command -> command.amountMinor() == 25000L
				&& command.paymentIntentId().equals("pi_1") && command.idempotencyKey().equals(refund.getIdempotencyKey())));
		verify(notifications).createRefundResult(eq(order.getCustomerId()), eq(orderId),
				eq("refund-" + refund.getId() + "-success"), eq(true));
	}

	@Test
	void failedStripeAttemptRemainsRetryableAndDoesNotMarkPaymentRefunded() {
		UUID orderId = UUID.randomUUID();
		Payment payment = paidPayment(orderId);
		PaymentAttempt attempt = successfulAttempt(payment.getId());
		DepositRefund refund = new DepositRefund(payment.getId(), "deadline-refund-" + payment.getId(),
				java.time.LocalDateTime.now(clock));
		when(refunds.findByIdForUpdate(refund.getId())).thenReturn(Optional.of(refund));
		when(payments.findByIdForUpdate(payment.getId())).thenReturn(Optional.of(payment));
		when(attempts.findFirstByPaymentIdOrderByAttemptNoDesc(payment.getId())).thenReturn(Optional.of(attempt));
		when(stripe.createRefund(any())).thenThrow(new StripeRefundException("Stripe unavailable", null));
		TransportOrder order = org.mockito.Mockito.mock(TransportOrder.class);
		when(order.getCustomerId()).thenReturn(UUID.randomUUID());
		when(order.getId()).thenReturn(orderId);
		when(orders.findById(orderId)).thenReturn(Optional.of(order));

		service.processOne(refund.getId());

		assertThat(payment.getStatus()).isEqualTo(PaymentStatus.PAID);
		assertThat(refund.getProviderStatus()).isEqualTo("FAILED");
		assertThat(refund.getNextAttemptAt()).isAfter(java.time.LocalDateTime.now(clock));
		assertThat(refund.getRetryCount()).isEqualTo(1);
	}

	private Payment paidPayment(UUID orderId) {
		Payment payment = new Payment(orderId, new BigDecimal("250.00"), "USD");
		payment.markPaid();
		return payment;
	}

	private PaymentAttempt successfulAttempt(UUID paymentId) {
		PaymentAttempt attempt = new PaymentAttempt(paymentId, 1);
		attempt.attachCheckoutSession("cs_1", "pi_1");
		attempt.markSucceeded("cs_1", "pi_1");
		return attempt;
	}
}
