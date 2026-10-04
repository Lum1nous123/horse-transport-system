package com.horsetransport.payment;

import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.horsetransport.notification.NotificationService;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DepositRefundService {
	private final DepositRefundRepository refunds;
	private final PaymentRepository payments;
	private final PaymentAttemptRepository attempts;
	private final PaymentProviderEventRepository events;
	private final TransportOrderRepository orders;
	private final StripePaymentGateway stripe;
	private final NotificationService notifications;
	private final Clock clock;

	public DepositRefundService(DepositRefundRepository refunds, PaymentRepository payments,
			PaymentAttemptRepository attempts, PaymentProviderEventRepository events,
			TransportOrderRepository orders, StripePaymentGateway stripe,
			NotificationService notifications, Clock clock) {
		this.refunds = refunds; this.payments = payments; this.attempts = attempts;
		this.events = events; this.orders = orders; this.stripe = stripe;
		this.notifications = notifications; this.clock = clock;
	}

	public int processDueRefunds() {
		List<UUID> ids = refunds.findDueIds(LocalDateTime.now(clock), PageRequest.of(0, 100));
		ids.forEach(this::processOne);
		return ids.size();
	}

	@Transactional
	public void processOne(UUID refundId) {
		DepositRefund refund = refunds.findByIdForUpdate(refundId).orElse(null);
		if (refund == null || refund.getCompletedAt() != null
				|| (refund.getNextAttemptAt() != null && refund.getNextAttemptAt().isAfter(LocalDateTime.now(clock)))) return;
		Payment payment = payments.findByIdForUpdate(refund.getPaymentId()).orElse(null);
		if (payment == null || payment.getPaymentType() != PaymentType.DEPOSIT || payment.getStatus() != PaymentStatus.PAID) {
			fail(refund, payment, null, "Deposit is not in a refundable PAID state"); return;
		}
		PaymentAttempt attempt = attempts.findFirstByPaymentIdOrderByAttemptNoDesc(payment.getId()).orElse(null);
		if (attempt == null || attempt.getProviderPaymentIntentId() == null || attempt.getProviderPaymentIntentId().isBlank()) {
			fail(refund, payment, null, "Stripe PaymentIntent reference is missing"); return;
		}
		long amount;
		try { amount = payment.getAmount().setScale(2, RoundingMode.UNNECESSARY).movePointRight(2).longValueExact(); }
		catch (ArithmeticException ex) { fail(refund, payment, null, "Deposit amount is invalid for Stripe"); return; }
		refund.markProcessing();
		Map<String, String> metadata = Map.of("refundIntentId", refund.getId().toString(),
				"paymentId", payment.getId().toString(), "orderId", payment.getTransportOrderId().toString(),
				"paymentType", PaymentType.DEPOSIT.name(), "refundIdempotencyKey", refund.getIdempotencyKey());
		try {
			StripeRefundResult result = stripe.createRefund(new StripeRefundCommand(
					attempt.getProviderPaymentIntentId(), amount, refund.getIdempotencyKey(), metadata));
			String validation = validateResult(result, attempt.getProviderPaymentIntentId(), amount, payment.getCurrency());
			if (validation != null) { fail(refund, payment, result == null ? null : result.refundId(), validation); return; }
			refund.recordProviderResult(result.refundId(), result.status());
			if ("succeeded".equals(result.status())) complete(refund, payment);
			else if ("failed".equals(result.status())) {
				fail(refund, payment, result.refundId(), "Stripe declined the refund; it will be retried");
				refund.rotateIdempotencyKey("refund-" + refund.getId() + "-retry-" + (refund.getRetryCount() + 1));
			}
			else refund.recordPending(LocalDateTime.now(clock).plusMinutes(5));
		}
		catch (RuntimeException ex) {
			fail(refund, payment, null, "Stripe refund request failed; it will be retried");
		}
		refunds.save(refund);
	}

	@Transactional
	public WebhookProcessingResult processRefundWebhook(StripeWebhookEvent event) {
		UUID refundId = parseUuid(event.metadata().get("refundIntentId"));
		UUID paymentId = parseUuid(event.metadata().get("paymentId"));
		if (refundId == null || paymentId == null || events.existsByProviderEventId(event.eventId()))
			return new WebhookProcessingResult(false, refundId != null, false);
		DepositRefund refund = refunds.findByIdForUpdate(refundId).orElse(null);
		Payment payment = payments.findByIdForUpdate(paymentId).orElse(null);
		if (refund == null || payment == null || !refund.getPaymentId().equals(paymentId))
			return new WebhookProcessingResult(false, false, false);
		// Recheck after taking the refund/payment locks: concurrent delivery can
		// pass the optimistic check above before either callback records its event.
		if (events.existsByProviderEventId(event.eventId()))
			return new WebhookProcessingResult(true, true, false);
		PaymentProviderEvent providerEvent = new PaymentProviderEvent(paymentId, null, event.eventId(), event.eventType());
		PaymentAttempt attempt = attempts.findFirstByPaymentIdOrderByAttemptNoDesc(paymentId).orElse(null);
		long amount = toMinor(payment.getAmount());
		if (payment.getPaymentType() != PaymentType.DEPOSIT || attempt == null
				|| attempt.getProviderPaymentIntentId() == null
				|| !attempt.getProviderPaymentIntentId().equals(event.paymentIntentId())
				|| (refund.getProviderRefundId() != null && !java.util.Objects.equals(event.checkoutSessionId(), refund.getProviderRefundId()))
				|| !refund.getIdempotencyKey().equals(event.metadata().get("refundIdempotencyKey"))
				|| !payment.getTransportOrderId().toString().equals(event.metadata().get("orderId"))
				|| !PaymentType.DEPOSIT.name().equals(event.metadata().get("paymentType"))
				|| event.amountMinor() == null || event.amountMinor() != amount
				|| event.currency() == null || !payment.getCurrency().equalsIgnoreCase(event.currency())) {
			providerEvent.markRejected("Refund event identity, reference, amount, or currency does not match");
			events.saveAndFlush(providerEvent);
			return new WebhookProcessingResult(true, false, false);
		}
		if (event.kind() == StripeEventKind.REFUND_SUCCESS) {
			refund.recordProviderResult(event.checkoutSessionId(), "succeeded"); complete(refund, payment);
		}
		else if (event.kind() == StripeEventKind.REFUND_FAILED) {
			fail(refund, payment, event.checkoutSessionId(), "Stripe refund failed; it will be retried");
			refund.rotateIdempotencyKey("refund-" + refund.getId() + "-retry-" + (refund.getRetryCount() + 1));
		}
		else refund.recordPending(LocalDateTime.now(clock).plusMinutes(5));
		providerEvent.markProcessed(); events.saveAndFlush(providerEvent); refunds.save(refund);
		return new WebhookProcessingResult(true, false, false);
	}

	private String validateResult(StripeRefundResult result, String intentId, long amount, String currency) {
		if (result == null || result.refundId() == null || result.refundId().isBlank()) return "Stripe refund reference is missing";
		if (!intentId.equals(result.paymentIntentId())) return "Stripe PaymentIntent reference does not match";
		if (result.amountMinor() == null || result.amountMinor() != amount) return "Stripe refund amount does not match";
		if (result.currency() == null || !currency.equalsIgnoreCase(result.currency())) return "Stripe refund currency does not match";
		if (result.status() == null || !List.of("succeeded", "pending", "requires_action", "failed").contains(result.status()))
			return "Stripe refund status is invalid";
		return null;
	}

	private void complete(DepositRefund refund, Payment payment) {
		payment.markRefunded(LocalDateTime.now(clock));
		refund.markCompletedAt(LocalDateTime.now(clock));
		TransportOrder order = orders.findById(payment.getTransportOrderId()).orElse(null);
		if (order != null) notifications.createRefundResult(order.getCustomerId(), order.getId(),
				"refund-" + refund.getId() + "-success", true);
		payments.save(payment);
	}

	private void fail(DepositRefund refund, Payment payment, String providerRefundId, String message) {
		if (providerRefundId != null) refund.recordProviderFailure(providerRefundId, message,
				LocalDateTime.now(clock).plusMinutes(Math.min(60, 1L << Math.min(refund.getRetryCount(), 6))));
		else refund.recordFailure(message,
				LocalDateTime.now(clock).plusMinutes(Math.min(60, 1L << Math.min(refund.getRetryCount(), 6))));
		if (payment != null) {
			payment.restorePaidAfterRefundFailure(); payments.save(payment);
			TransportOrder order = orders.findById(payment.getTransportOrderId()).orElse(null);
			if (order != null) notifications.createRefundResult(order.getCustomerId(), order.getId(),
					"refund-" + refund.getId() + "-failure-" + refund.getRetryCount(), false);
		}
	}

	private long toMinor(java.math.BigDecimal amount) {
		return amount.setScale(2, RoundingMode.UNNECESSARY).movePointRight(2).longValueExact();
	}
	private UUID parseUuid(String value) { try { return value == null ? null : UUID.fromString(value); }
		catch (IllegalArgumentException ex) { return null; } }
}
