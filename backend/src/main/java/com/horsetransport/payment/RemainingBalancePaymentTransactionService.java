package com.horsetransport.payment;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.horsetransport.order.OrderNotFoundException;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.quotation.Quotation;
import com.horsetransport.quotation.QuotationRepository;
import com.horsetransport.quotation.QuotationStatus;
import com.horsetransport.security.CurrentUserProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service
public class RemainingBalancePaymentTransactionService {

	private static final String METADATA_ORDER_ID = "orderId";
	private static final String METADATA_QUOTATION_ID = "quotationId";
	private static final String METADATA_PAYMENT_ID = "paymentId";
	private static final String METADATA_ATTEMPT_ID = "paymentAttemptId";
	private static final String METADATA_PAYMENT_TYPE = "paymentType";

	private final PaymentRepository paymentRepository;
    private final PaymentAttemptRepository attemptRepository;
    private final PaymentProviderEventRepository eventRepository;
    private final TransportOrderRepository orderRepository;
    private final QuotationRepository quotationRepository;
    private final CurrentUserProvider currentUserProvider;

	public RemainingBalancePaymentTransactionService(PaymentRepository paymentRepository,
		PaymentAttemptRepository attemptRepository,
		PaymentProviderEventRepository eventRepository,
		TransportOrderRepository orderRepository,
		QuotationRepository quotationRepository,
		CurrentUserProvider currentUserProvider) {
	this.paymentRepository = paymentRepository;
	this.attemptRepository = attemptRepository;
	this.eventRepository = eventRepository;
	this.orderRepository = orderRepository;
	this.quotationRepository = quotationRepository;
	this.currentUserProvider = currentUserProvider;
    }
    @Transactional
    public WebhookProcessingResult processWebhook(StripeWebhookEvent stripeEvent) {
	if (stripeEvent.kind() == StripeEventKind.IGNORED) {
		return new WebhookProcessingResult(false, false, false);
	}

	UUID paymentId = parseUuid(stripeEvent.metadata().get(METADATA_PAYMENT_ID));
	UUID attemptId = parseUuid(stripeEvent.metadata().get(METADATA_ATTEMPT_ID));

	if (paymentId == null || attemptId == null) {
		return new WebhookProcessingResult(false, false, false);
	}

	Payment payment = paymentRepository.findByIdForUpdate(paymentId).orElse(null);
	if (payment == null) {
		return new WebhookProcessingResult(false, false, false);
	}

	if (eventRepository.existsByProviderEventId(stripeEvent.eventId())) {
		return new WebhookProcessingResult(true, true, false);
	}

	PaymentAttempt attempt = attemptRepository.findByIdForUpdate(attemptId).orElse(null);

	PaymentProviderEvent event = new PaymentProviderEvent(
			paymentId,
			attempt == null ? null : attemptId,
			stripeEvent.eventId(),
			stripeEvent.eventType());

	String identityError = validateEventIdentity(stripeEvent, payment, attempt);
	if (identityError != null) {
		event.markRejected(identityError);
		eventRepository.saveAndFlush(event);
		return new WebhookProcessingResult(true, false, false);
	}

	if (stripeEvent.kind() == StripeEventKind.FAILED) {
		event.markProcessed();
		eventRepository.saveAndFlush(event);
		return new WebhookProcessingResult(true, false, false);
	}

	if (stripeEvent.kind() != StripeEventKind.SUCCESS) {
		if (payment.getStatus() != PaymentStatus.PENDING || !attempt.getProviderStatus().isActive()) {
			event.markProcessed();
			eventRepository.saveAndFlush(event);
			return new WebhookProcessingResult(true, true, false);
		}

		attempt.markTerminal(toAttemptStatus(stripeEvent.kind()),
				stripeEvent.checkoutSessionId(),
				stripeEvent.paymentIntentId());

		event.markProcessed();
		attemptRepository.save(attempt);
		eventRepository.saveAndFlush(event);
		return new WebhookProcessingResult(true, false, false);
	}

	if (payment.getStatus() == PaymentStatus.PAID) {
		event.markProcessed();
		eventRepository.saveAndFlush(event);
		return new WebhookProcessingResult(true, true, false);
	}

	if (!attempt.getProviderStatus().isActive()) {
		event.markRejected("Payment attempt is no longer active");
		eventRepository.saveAndFlush(event);
		return new WebhookProcessingResult(true, false, false);
	}

	String valueError = validateSuccessValues(stripeEvent, payment);
	if (valueError != null) {
		event.markRejected(valueError);
		eventRepository.saveAndFlush(event);
		return new WebhookProcessingResult(true, false, false);
	}

	TransportOrder order = orderRepository.findByIdForUpdate(payment.getTransportOrderId()).orElse(null);
	Quotation quotation = quotationRepository.findByTransportOrderId(payment.getTransportOrderId()).orElse(null);

	String stateError = validateRemainingBalanceState(stripeEvent, order, quotation, payment);
	if (stateError != null) {
		event.markRejected(stateError);
		eventRepository.saveAndFlush(event);
		return new WebhookProcessingResult(true, false, false);
	}

	payment.markPaid();
	attempt.markSucceeded(stripeEvent.checkoutSessionId(), stripeEvent.paymentIntentId());
	order.openFrcEligibility();
	event.markProcessed();

	paymentRepository.save(payment);
	attemptRepository.save(attempt);
	orderRepository.save(order);
	eventRepository.saveAndFlush(event);

	return new WebhookProcessingResult(true, false, false);
}

	@Transactional
	public PreparedRemainingBalanceCheckout prepareCheckout(UUID orderId) {
		UUID customerId = currentUserProvider.getCurrentUserId();
		TransportOrder order = orderRepository.findOwnedByIdForUpdate(orderId, customerId)
				.orElseThrow(OrderNotFoundException::new);

		if (!isFinalConfirmed(order)) {
			throw new DepositPaymentConflictException("Order must be Final Confirmed to start Remaining Balance checkout");
		}

		Quotation quotation = quotationRepository.findByTransportOrderId(orderId)
				.orElseThrow(() -> new DepositPaymentConflictException("A sent quotation is required"));

		validateSentQuotation(quotation);

		BigDecimal remainingAmount = calculateRemainingAmount(quotation);

		Payment payment = paymentRepository
				.findByTransportOrderIdAndPaymentType(orderId, PaymentType.REMAINING_BALANCE)
				.orElseGet(() -> paymentRepository.saveAndFlush(
						Payment.remainingBalance(orderId, remainingAmount, quotation.getCurrency())));

		validatePendingPayment(payment, remainingAmount, quotation.getCurrency());

		Optional<PaymentAttempt> latest = attemptRepository.findFirstByPaymentIdOrderByAttemptNoDesc(payment.getId());

		PaymentAttempt attempt;
		if (latest.isPresent() && latest.get().getProviderStatus().isActive()) {
			attempt = latest.get();
		}
		else {
			if (latest.isPresent() && latest.get().getProviderStatus() == PaymentAttemptStatus.SUCCEEDED) {
				throw new DepositPaymentConflictException("A successful Remaining Balance attempt already exists");
			}
			int attemptNo = latest.map(value -> value.getAttemptNo() + 1).orElse(1);
			attempt = attemptRepository.saveAndFlush(
					new PaymentAttempt(payment.getId(), PaymentType.REMAINING_BALANCE, attemptNo));
		}

		Map<String, String> metadata = Map.of(
				METADATA_ORDER_ID, order.getId().toString(),
				METADATA_QUOTATION_ID, quotation.getId().toString(),
				METADATA_PAYMENT_ID, payment.getId().toString(),
				METADATA_ATTEMPT_ID, attempt.getId().toString(),
				METADATA_PAYMENT_TYPE, PaymentType.REMAINING_BALANCE.name());

		StripeCheckoutCommand command = new StripeCheckoutCommand(
				orderId,
				payment.getAmount(),
				payment.getCurrency(),
				attempt.getIdempotencyKey(),
				metadata);

		return new PreparedRemainingBalanceCheckout(payment, attempt, command);
	}

	@Transactional
	public RemainingBalanceCheckoutResponse attachCheckoutSession(UUID paymentId, UUID attemptId,
			StripeCheckoutSession session) {
		Payment payment = paymentRepository.findByIdForUpdate(paymentId)
				.orElseThrow(DepositPaymentNotFoundException::new);

		PaymentAttempt attempt = attemptRepository.findByIdForUpdate(attemptId)
				.orElseThrow(() -> new DepositPaymentConflictException("Remaining Balance payment attempt was not found"));

		if (!attempt.getPaymentId().equals(payment.getId())) {
			throw new DepositPaymentConflictException("Remaining Balance payment attempt does not match the payment");
		}

		if (attempt.getProviderStatus() == PaymentAttemptStatus.SUCCEEDED
				&& session.id().equals(attempt.getProviderCheckoutSessionId())) {
			return new RemainingBalanceCheckoutResponse(
					payment.getId(),
					attempt.getId(),
					session.id(),
					session.url(),
					payment.getStatus());
		}

		if (!attempt.getProviderStatus().isActive()) {
			throw new DepositPaymentConflictException("Remaining Balance payment attempt is no longer active");
		}

		if (attempt.getProviderCheckoutSessionId() != null
				&& !attempt.getProviderCheckoutSessionId().equals(session.id())) {
			throw new DepositPaymentConflictException("Stripe Checkout session does not match the active attempt");
		}

		attempt.attachCheckoutSession(session.id(), session.paymentIntentId());
		attemptRepository.save(attempt);

		return new RemainingBalanceCheckoutResponse(
				payment.getId(),
				attempt.getId(),
				session.id(),
				session.url(),
				payment.getStatus());
	}

	@Transactional(readOnly = true)
	public RemainingBalanceResponse getRemainingBalance(UUID orderId) {
		UUID customerId = currentUserProvider.getCurrentUserId();
		TransportOrder order = orderRepository.findByIdAndCustomerId(orderId, customerId)
				.orElseThrow(OrderNotFoundException::new);

		Quotation quotation = quotationRepository.findByTransportOrderId(orderId)
				.orElseThrow(() -> new DepositPaymentConflictException("A sent quotation is required"));

		validateSentQuotation(quotation);

		BigDecimal remainingAmount = calculateRemainingAmount(quotation);

		Payment payment = paymentRepository
				.findByTransportOrderIdAndPaymentType(orderId, PaymentType.REMAINING_BALANCE)
				.orElse(null);

		if (!isFinalConfirmed(order)) {
			return new RemainingBalanceResponse(
					orderId,
					remainingAmount,
					quotation.getCurrency(),
					payment == null ? PaymentStatus.PENDING.name() : payment.getStatus().name(),
					false,
					"Order must be Final Confirmed");
		}

		if (payment != null && payment.getStatus() == PaymentStatus.PAID) {
			return new RemainingBalanceResponse(
					orderId,
					remainingAmount,
					quotation.getCurrency(),
					PaymentStatus.PAID.name(),
					false,
					"Remaining Balance is already paid");
		}

		return new RemainingBalanceResponse(
				orderId,
				remainingAmount,
				quotation.getCurrency(),
				payment == null ? PaymentStatus.PENDING.name() : payment.getStatus().name(),
				true,
				null);
	}

	private boolean isFinalConfirmed(TransportOrder order) {
		return order.getStatus() == OrderStatus.APPROVED && order.getDocumentsLockedAt() != null;
	}

	private void validateSentQuotation(Quotation quotation) {
		if (quotation.getStatus() != QuotationStatus.SENT
				|| quotation.getTotalAmount() == null
				|| quotation.getDepositAmount() == null
				|| quotation.getCurrency() == null
				|| quotation.getCurrency().isBlank()) {
			throw new DepositPaymentConflictException("A complete SENT quotation is required");
		}
	}

	private BigDecimal calculateRemainingAmount(Quotation quotation) {
		BigDecimal remainingAmount = quotation.getTotalAmount().subtract(quotation.getDepositAmount());
		if (remainingAmount.signum() <= 0) {
			throw new DepositPaymentConflictException("Remaining Balance must be greater than zero");
		}
		if (quotation.getRemainingAmount() != null
				&& quotation.getRemainingAmount().compareTo(remainingAmount) != 0) {
			throw new DepositPaymentConflictException("Quotation remaining amount does not match quotation arithmetic");
		}
		return remainingAmount;
	}

	private void validatePendingPayment(Payment payment, BigDecimal remainingAmount, String currency) {
		if (payment.getStatus() != PaymentStatus.PENDING) {
			throw new DepositPaymentConflictException("Remaining Balance payment is not pending");
		}
		if (payment.getAmount().compareTo(remainingAmount) != 0
				|| !payment.getCurrency().equalsIgnoreCase(currency)) {
			throw new DepositPaymentConflictException("Remaining Balance payment does not match the sent quotation");
		}
	}
    private String validateEventIdentity(StripeWebhookEvent event, Payment payment, PaymentAttempt attempt) {
	if (attempt == null || !attempt.getPaymentId().equals(payment.getId())) {
		return "Payment attempt does not match";
	}
	if (payment.getPaymentType() != PaymentType.REMAINING_BALANCE
			|| !PaymentType.REMAINING_BALANCE.name().equals(event.metadata().get(METADATA_PAYMENT_TYPE))) {
		return "Payment type does not match";
	}
	if (!payment.getTransportOrderId().toString().equals(event.metadata().get(METADATA_ORDER_ID))) {
		return "Order metadata does not match";
	}
	if (attempt.getProviderCheckoutSessionId() != null && event.checkoutSessionId() != null
			&& !attempt.getProviderCheckoutSessionId().equals(event.checkoutSessionId())) {
		return "Checkout Session does not match";
	}
	if (attempt.getProviderPaymentIntentId() != null && event.paymentIntentId() != null
			&& !attempt.getProviderPaymentIntentId().equals(event.paymentIntentId())) {
		return "PaymentIntent does not match";
	}
	return null;
}

private String validateSuccessValues(StripeWebhookEvent event, Payment payment) {
	long expectedAmount;
	try {
		expectedAmount = payment.getAmount().setScale(2, RoundingMode.UNNECESSARY)
				.movePointRight(2).longValueExact();
	}
	catch (ArithmeticException exception) {
		return "Payment amount cannot be represented in Stripe minor units";
	}

	if (event.amountMinor() == null || event.amountMinor() != expectedAmount) {
		return "Payment amount does not match";
	}
	if (event.currency() == null || !payment.getCurrency().equalsIgnoreCase(event.currency())) {
		return "Payment currency does not match";
	}
	if (event.checkoutSessionId() == null || event.paymentIntentId() == null) {
		return "Stripe payment identifiers are missing";
	}
	return null;
}

private String validateRemainingBalanceState(StripeWebhookEvent event, TransportOrder order,
		Quotation quotation, Payment payment) {
	if (order == null || !isFinalConfirmed(order)) {
		return "Order is not Final Confirmed";
	}
	if (quotation == null || quotation.getStatus() != QuotationStatus.SENT) {
		return "Quotation is no longer SENT";
	}
	if (!quotation.getId().toString().equals(event.metadata().get(METADATA_QUOTATION_ID))) {
		return "Quotation metadata does not match";
	}

	BigDecimal remainingAmount = calculateRemainingAmount(quotation);

	if (remainingAmount.compareTo(payment.getAmount()) != 0
			|| quotation.getCurrency() == null
			|| !quotation.getCurrency().equalsIgnoreCase(payment.getCurrency())) {
		return "Quotation amount or currency does not match the payment";
	}
	return null;
}

private PaymentAttemptStatus toAttemptStatus(StripeEventKind kind) {
	return switch (kind) {
		case CANCELLED -> PaymentAttemptStatus.CANCELLED;
		case EXPIRED -> PaymentAttemptStatus.EXPIRED;
		default -> throw new IllegalArgumentException("Event kind is not terminal");
	};
}

private UUID parseUuid(String value) {
	try {
		return value == null ? null : UUID.fromString(value);
	}
	catch (IllegalArgumentException exception) {
		return null;
	}
}
}
