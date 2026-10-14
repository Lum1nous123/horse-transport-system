package com.horsetransport.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import com.horsetransport.notification.NotificationService;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@ExtendWith(MockitoExtension.class)
class DepositRefundProcessorTest {
	@Mock private DepositRefundRepository refunds;
	@Mock private PaymentRepository payments;
	@Mock private PaymentAttemptRepository attempts;
	@Mock private PaymentProviderEventRepository events;
	@Mock private TransportOrderRepository orders;
	@Mock private StripePaymentGateway stripe;
	@Mock private NotificationService notifications;
	private final Clock clock = Clock.fixed(Instant.parse("2026-10-04T10:00:00Z"), ZoneOffset.UTC);
	private DepositRefundProcessor processor;

	@BeforeEach
	void setUp() {
		processor = new DepositRefundProcessor(refunds, payments, attempts, events, orders, stripe, notifications, clock);
	}

	@Test
	void processOneDeclaresRequiresNewTransaction() throws NoSuchMethodException {
		Transactional transaction = DepositRefundProcessor.class.getMethod("processOne", UUID.class)
				.getAnnotation(Transactional.class);

		assertThat(transaction).isNotNull();
		assertThat(transaction.propagation()).isEqualTo(Propagation.REQUIRES_NEW);
	}

	@Test
	void fullRefundLocksRefundBeforePaymentAndCreatesOneSuccessNotification() {
		UUID orderId = UUID.randomUUID();
		TransportOrder order = org.mockito.Mockito.mock(TransportOrder.class);
		when(order.getCustomerId()).thenReturn(UUID.randomUUID());
		when(order.getId()).thenReturn(orderId);
		Payment payment = paidPayment(orderId);
		PaymentAttempt attempt = successfulAttempt(payment.getId());
		DepositRefund refund = new DepositRefund(payment.getId(), "deadline-refund-" + payment.getId(),
				LocalDateTime.now(clock));
		when(refunds.findByIdForUpdate(refund.getId())).thenReturn(Optional.of(refund));
		when(payments.findByIdForUpdate(payment.getId())).thenReturn(Optional.of(payment));
		when(attempts.findFirstByPaymentIdOrderByAttemptNoDesc(payment.getId())).thenReturn(Optional.of(attempt));
		when(stripe.createRefund(any())).thenReturn(new StripeRefundResult("re_1", "pi_1", 25000L, "usd", "succeeded"));
		when(orders.findById(orderId)).thenReturn(Optional.of(order));

		processor.processOne(refund.getId());

		assertThat(payment.getStatus()).isEqualTo(PaymentStatus.REFUNDED);
		assertThat(refund.getProviderStatus()).isEqualTo("succeeded");
		assertThat(refund.getCompletedAt()).isNotNull();
		InOrder lockOrder = inOrder(refunds, payments);
		lockOrder.verify(refunds).findByIdForUpdate(refund.getId());
		lockOrder.verify(payments).findByIdForUpdate(payment.getId());
		verify(stripe).createRefund(org.mockito.ArgumentMatchers.argThat(command -> command.amountMinor() == 25000L
				&& command.paymentIntentId().equals("pi_1") && command.idempotencyKey().equals(refund.getIdempotencyKey())));
		verify(notifications).createRefundResult(eq(order.getCustomerId()), eq(orderId),
				eq("refund-" + refund.getId() + "-success"), eq(true));
	}

	@Test
	void unknownStripeOutcomeRemainsRetryableWithSameIdempotencyKey() {
		UUID orderId = UUID.randomUUID();
		Payment payment = paidPayment(orderId);
		PaymentAttempt attempt = successfulAttempt(payment.getId());
		DepositRefund refund = new DepositRefund(payment.getId(), "deadline-refund-" + payment.getId(),
				LocalDateTime.now(clock));
		String originalKey = refund.getIdempotencyKey();
		when(refunds.findByIdForUpdate(refund.getId())).thenReturn(Optional.of(refund));
		when(payments.findByIdForUpdate(payment.getId())).thenReturn(Optional.of(payment));
		when(attempts.findFirstByPaymentIdOrderByAttemptNoDesc(payment.getId())).thenReturn(Optional.of(attempt));
		when(stripe.createRefund(any())).thenThrow(new StripeRefundException("Stripe timeout", null));
		TransportOrder order = org.mockito.Mockito.mock(TransportOrder.class);
		when(order.getCustomerId()).thenReturn(UUID.randomUUID());
		when(order.getId()).thenReturn(orderId);
		when(orders.findById(orderId)).thenReturn(Optional.of(order));

		processor.processOne(refund.getId());

		assertThat(payment.getStatus()).isEqualTo(PaymentStatus.PAID);
		assertThat(refund.getProviderStatus()).isEqualTo("FAILED");
		assertThat(refund.getNextAttemptAt()).isAfter(LocalDateTime.now(clock));
		assertThat(refund.getRetryCount()).isEqualTo(1);
		assertThat(refund.getIdempotencyKey()).isEqualTo(originalKey);
	}

	@Test
	void notificationFailurePropagatesInsteadOfBeingRecordedAsStripeFailure() {
		UUID orderId = UUID.randomUUID();
		TransportOrder order = org.mockito.Mockito.mock(TransportOrder.class);
		when(order.getCustomerId()).thenReturn(UUID.randomUUID());
		when(order.getId()).thenReturn(orderId);
		Payment payment = paidPayment(orderId);
		PaymentAttempt attempt = successfulAttempt(payment.getId());
		DepositRefund refund = new DepositRefund(payment.getId(), "deadline-refund-" + payment.getId(),
				LocalDateTime.now(clock));
		when(refunds.findByIdForUpdate(refund.getId())).thenReturn(Optional.of(refund));
		when(payments.findByIdForUpdate(payment.getId())).thenReturn(Optional.of(payment));
		when(attempts.findFirstByPaymentIdOrderByAttemptNoDesc(payment.getId())).thenReturn(Optional.of(attempt));
		when(stripe.createRefund(any())).thenReturn(new StripeRefundResult("re_1", "pi_1", 25000L, "usd", "succeeded"));
		when(orders.findById(orderId)).thenReturn(Optional.of(order));
		org.mockito.Mockito.doThrow(new IllegalStateException("notification database unavailable"))
				.when(notifications).createRefundResult(any(), any(), any(), eq(true));

		assertThatThrownBy(() -> processor.processOne(refund.getId()))
				.isInstanceOf(IllegalStateException.class)
				.hasMessage("notification database unavailable");

		assertThat(refund.getProviderStatus()).isEqualTo("succeeded");
		assertThat(refund.getProcessingError()).isNull();
		verify(refunds, never()).save(refund);
		verify(payments, never()).save(payment);
	}

	@Test
	void completedRefundIsRecheckedAfterRefundLockAndSkipped() {
		Payment payment = paidPayment(UUID.randomUUID());
		DepositRefund refund = new DepositRefund(payment.getId(), "deadline-refund-" + payment.getId(),
				LocalDateTime.now(clock));
		refund.recordProviderResult("re_completed", "succeeded");
		refund.markCompletedAt(LocalDateTime.now(clock));
		when(refunds.findByIdForUpdate(refund.getId())).thenReturn(Optional.of(refund));

		processor.processOne(refund.getId());

		verify(payments, never()).findByIdForUpdate(any());
		verify(stripe, never()).createRefund(any());
	}

	private Payment paidPayment(UUID orderId) {
		Payment payment = new Payment(orderId, PaymentType.DEPOSIT, new BigDecimal("250.00"), "USD");
		payment.markPaid();
		return payment;
	}

	private PaymentAttempt successfulAttempt(UUID paymentId) {
		PaymentAttempt attempt = new PaymentAttempt(paymentId, PaymentType.DEPOSIT, 1);
		attempt.attachCheckoutSession("cs_1", "pi_1");
		attempt.markSucceeded("cs_1", "pi_1");
		return attempt;
	}
}
