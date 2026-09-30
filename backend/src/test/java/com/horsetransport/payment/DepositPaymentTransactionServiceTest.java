package com.horsetransport.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Constructor;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import com.stripe.Stripe;
import com.horsetransport.audit.AuditActorKind;
import com.horsetransport.audit.AuditEntityType;
import com.horsetransport.audit.StatusAuditLog;
import com.horsetransport.audit.StatusAuditLogRepository;
import com.horsetransport.order.OrderNotFoundException;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.quotation.Quotation;
import com.horsetransport.quotation.QuotationRepository;
import com.horsetransport.quotation.QuotationStatus;
import com.horsetransport.security.CurrentUserProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class DepositPaymentTransactionServiceTest {

	private static final UUID CUSTOMER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final UUID ORDER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
	private static final UUID QUOTATION_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");

	@Mock private PaymentRepository paymentRepository;
	@Mock private PaymentAttemptRepository attemptRepository;
	@Mock private PaymentProviderEventRepository eventRepository;
	@Mock private TransportOrderRepository orderRepository;
	@Mock private QuotationRepository quotationRepository;
	@Mock private StatusAuditLogRepository auditLogRepository;
	@Mock private CurrentUserProvider currentUserProvider;
	@Mock private DocumentPhaseStarter documentPhaseStarter;

	private DepositPaymentTransactionService service;

	@BeforeEach
	void setUp() {
		service = new DepositPaymentTransactionService(paymentRepository, attemptRepository, eventRepository,
				orderRepository, quotationRepository, auditLogRepository, currentUserProvider, documentPhaseStarter);
		lenient().when(currentUserProvider.getCurrentUserId()).thenReturn(CUSTOMER_ID);
	}

	@Test
	void ownedCustomerCreatesPendingDepositFromServerSideQuotationValues() {
		TransportOrder order = order(OrderStatus.QUOTATION_SENT);
		Quotation quotation = sentQuotation();
		when(orderRepository.findOwnedByIdForUpdate(ORDER_ID, CUSTOMER_ID)).thenReturn(Optional.of(order));
		when(quotationRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(quotation));
		when(paymentRepository.findByTransportOrderIdAndPaymentType(ORDER_ID, PaymentType.DEPOSIT))
				.thenReturn(Optional.empty());
		when(paymentRepository.saveAndFlush(any(Payment.class))).thenAnswer(invocation -> invocation.getArgument(0));
		when(attemptRepository.findFirstByPaymentIdOrderByAttemptNoDesc(any())).thenReturn(Optional.empty());
		when(attemptRepository.saveAndFlush(any(PaymentAttempt.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		PreparedDepositCheckout prepared = service.prepareCheckout(ORDER_ID);

		assertThat(prepared.payment().getPaymentType()).isEqualTo(PaymentType.DEPOSIT);
		assertThat(prepared.payment().getStatus()).isEqualTo(PaymentStatus.PENDING);
		assertThat(prepared.command().amount()).isEqualByComparingTo("250.00");
		assertThat(prepared.command().currency()).isEqualTo("USD");
		assertThat(prepared.command().metadata()).containsEntry("orderId", ORDER_ID.toString())
				.containsEntry("quotationId", QUOTATION_ID.toString())
				.containsEntry("paymentType", "DEPOSIT");
	}

	@Test
	void reusesOnlyActiveAttemptAndLogicalPayment() {
		Payment payment = payment();
		PaymentAttempt attempt = attempt(payment);
		attempt.attachCheckoutSession("cs_active", "pi_active");
		stubCheckoutState(payment, attempt);

		PreparedDepositCheckout prepared = service.prepareCheckout(ORDER_ID);

		assertThat(prepared.payment()).isSameAs(payment);
		assertThat(prepared.attempt()).isSameAs(attempt);
		assertThat(prepared.command().idempotencyKey()).isEqualTo(attempt.getIdempotencyKey());
		verify(paymentRepository, never()).saveAndFlush(any());
		verify(attemptRepository, never()).saveAndFlush(any());
	}

	@ParameterizedTest
	@EnumSource(value = PaymentAttemptStatus.class, names = {"CANCELLED", "EXPIRED"})
	void createsNextAttemptOnlyAfterPreviousAttemptEnded(PaymentAttemptStatus endedStatus) {
		Payment payment = payment();
		PaymentAttempt ended = attempt(payment);
		ended.markTerminal(endedStatus);
		stubCheckoutState(payment, ended);
		when(attemptRepository.saveAndFlush(any(PaymentAttempt.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		PreparedDepositCheckout prepared = service.prepareCheckout(ORDER_ID);

		assertThat(prepared.attempt()).isNotSameAs(ended);
		assertThat(prepared.attempt().getAttemptNo()).isEqualTo(2);
		assertThat(prepared.attempt().getProviderStatus()).isEqualTo(PaymentAttemptStatus.PENDING);
	}

	@Test
	void blocksNonOwnerAndInvalidOrderOrQuotationState() {
		when(orderRepository.findOwnedByIdForUpdate(ORDER_ID, CUSTOMER_ID)).thenReturn(Optional.empty());
		assertThatThrownBy(() -> service.prepareCheckout(ORDER_ID)).isInstanceOf(OrderNotFoundException.class);

		when(orderRepository.findOwnedByIdForUpdate(ORDER_ID, CUSTOMER_ID))
				.thenReturn(Optional.of(order(OrderStatus.SUBMITTED)));
		assertThatThrownBy(() -> service.prepareCheckout(ORDER_ID))
				.isInstanceOf(DepositPaymentConflictException.class).hasMessageContaining("QUOTATION_SENT");

		when(orderRepository.findOwnedByIdForUpdate(ORDER_ID, CUSTOMER_ID))
				.thenReturn(Optional.of(order(OrderStatus.QUOTATION_SENT)));
		Quotation draft = sentQuotation();
		ReflectionTestUtils.setField(draft, "status", QuotationStatus.DRAFT);
		when(quotationRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(draft));
		assertThatThrownBy(() -> service.prepareCheckout(ORDER_ID))
				.isInstanceOf(DepositPaymentConflictException.class).hasMessageContaining("SENT");
	}

	@ParameterizedTest
	@EnumSource(value = StripeEventKind.class, names = {"CANCELLED", "EXPIRED"})
	void terminalAttemptEventLeavesLogicalPaymentAndOrderUnchanged(StripeEventKind kind) {
		WebhookFixture fixture = webhookFixture(OrderStatus.QUOTATION_SENT);

		WebhookProcessingResult result = service.processWebhook(event("evt_terminal", kind, fixture));

		assertThat(result.processed()).isTrue();
		assertThat(fixture.payment().getStatus()).isEqualTo(PaymentStatus.PENDING);
		assertThat(fixture.order().getStatus()).isEqualTo(OrderStatus.QUOTATION_SENT);
		assertThat(fixture.attempt().getProviderStatus().name()).isEqualTo(kind.name());
		verify(auditLogRepository, never()).saveAndFlush(any());
		verify(documentPhaseStarter, never()).startForOrder(any());
	}

	@Test
	void signedCardDeclineKeepsCheckoutActiveAndLaterSignedSuccessApprovesExactlyOnce() throws Exception {
		WebhookFixture fixture = webhookFixture(OrderStatus.QUOTATION_SENT);
		StripePaymentGatewayAdapter stripe = new StripePaymentGatewayAdapter(
				"sk_test_not_used", "whsec_regression", "https://example.test/success", "https://example.test/cancel");
		String failedPayload = stripeEventPayload("evt_failed", "payment_intent.payment_failed",
				"payment_intent", "requires_payment_method", fixture);
		StripeWebhookEvent cardDecline = stripe.verifyAndParseWebhook(
				failedPayload, stripeSignature(failedPayload, "whsec_regression"));

		WebhookProcessingResult failedResult = service.processWebhook(cardDecline);

		assertThat(failedResult.processed()).isTrue();
		assertThat(fixture.attempt().getProviderStatus()).isEqualTo(PaymentAttemptStatus.OPEN);
		assertThat(fixture.payment().getStatus()).isEqualTo(PaymentStatus.PENDING);
		assertThat(fixture.order().getStatus()).isEqualTo(OrderStatus.QUOTATION_SENT);

		stubCheckoutState(fixture.payment(), fixture.attempt());
		PreparedDepositCheckout retry = service.prepareCheckout(ORDER_ID);
		assertThat(retry.attempt()).isSameAs(fixture.attempt());
		verify(attemptRepository, never()).saveAndFlush(any());

		when(eventRepository.existsByProviderEventId("evt_success")).thenReturn(false, true);
		String successPayload = stripeEventPayload("evt_success", "checkout.session.completed",
				"checkout.session", "paid", fixture);
		StripeWebhookEvent success = stripe.verifyAndParseWebhook(
				successPayload, stripeSignature(successPayload, "whsec_regression"));
		WebhookProcessingResult successResult = service.processWebhook(success);
		WebhookProcessingResult replayResult = service.processWebhook(success);

		assertThat(successResult.orderApproved()).isTrue();
		assertThat(replayResult.duplicate()).isTrue();
		assertThat(fixture.attempt().getProviderStatus()).isEqualTo(PaymentAttemptStatus.SUCCEEDED);
		assertThat(fixture.payment().getStatus()).isEqualTo(PaymentStatus.PAID);
		assertThat(fixture.order().getStatus()).isEqualTo(OrderStatus.APPROVED);
		verify(auditLogRepository).saveAndFlush(any());
		verify(documentPhaseStarter).startForOrder(ORDER_ID);
	}

	@Test
	void successAtomicallyPaysDepositApprovesOrderAuditsAsSystemAndCallsHook() {
		WebhookFixture fixture = webhookFixture(OrderStatus.QUOTATION_SENT);

		WebhookProcessingResult result = service.processWebhook(event("evt_success", StripeEventKind.SUCCESS, fixture));

		assertThat(result.orderApproved()).isTrue();
		assertThat(fixture.payment().getStatus()).isEqualTo(PaymentStatus.PAID);
		assertThat(fixture.payment().getPaidAt()).isNotNull();
		assertThat(fixture.order().getStatus()).isEqualTo(OrderStatus.APPROVED);
		assertThat(fixture.order().getApprovedAt()).isNotNull();
		assertThat(fixture.quotation().getStatus()).isEqualTo(QuotationStatus.SENT);
		ArgumentCaptor<StatusAuditLog> auditCaptor = ArgumentCaptor.forClass(StatusAuditLog.class);
		verify(auditLogRepository).saveAndFlush(auditCaptor.capture());
		StatusAuditLog audit = auditCaptor.getValue();
		assertThat(audit.getEntityType()).isEqualTo(AuditEntityType.TRANSPORT_ORDER);
		assertThat(audit.getEntityId()).isEqualTo(ORDER_ID);
		assertThat(audit.getOldStatus()).isEqualTo("QUOTATION_SENT");
		assertThat(audit.getNewStatus()).isEqualTo("APPROVED");
		assertThat(audit.getActorKind()).isEqualTo(AuditActorKind.SYSTEM);
		assertThat(audit.getActorUserId()).isNull();
		assertThat(audit.getReason()).isNull();
		assertThat(audit.getOccurredAt()).isNotNull();
		verify(documentPhaseStarter).startForOrder(ORDER_ID);
	}

	@Test
	void duplicateWebhookHasNoRepeatedSideEffects() {
		WebhookFixture fixture = webhookFixture(OrderStatus.QUOTATION_SENT);
		when(eventRepository.existsByProviderEventId("evt_duplicate")).thenReturn(true);

		WebhookProcessingResult result = service.processWebhook(
				event("evt_duplicate", StripeEventKind.SUCCESS, fixture));

		assertThat(result.duplicate()).isTrue();
		assertThat(fixture.payment().getStatus()).isEqualTo(PaymentStatus.PENDING);
		assertThat(fixture.order().getStatus()).isEqualTo(OrderStatus.QUOTATION_SENT);
		verify(auditLogRepository, never()).saveAndFlush(any());
		verify(documentPhaseStarter, never()).startForOrder(any());
	}

	@Test
	void lateSuccessNeverResurrectsCancelledOrder() {
		WebhookFixture fixture = webhookFixture(OrderStatus.CANCELLED);

		WebhookProcessingResult result = service.processWebhook(event("evt_late", StripeEventKind.SUCCESS, fixture));

		assertThat(result.orderApproved()).isFalse();
		assertThat(fixture.payment().getStatus()).isEqualTo(PaymentStatus.PENDING);
		assertThat(fixture.order().getStatus()).isEqualTo(OrderStatus.CANCELLED);
		verify(auditLogRepository, never()).saveAndFlush(any());
		verify(documentPhaseStarter, never()).startForOrder(any());
	}

	@Test
	void mismatchedAmountAndCurrencyNeverApprove() {
		WebhookFixture fixture = webhookFixture(OrderStatus.QUOTATION_SENT);
		StripeWebhookEvent mismatch = new StripeWebhookEvent("evt_mismatch", "checkout.session.completed",
				StripeEventKind.SUCCESS, "cs_1", "pi_1", 1L, "eur",
				metadata(fixture).entrySet().stream().collect(java.util.stream.Collectors.toMap(
						Map.Entry::getKey, Map.Entry::getValue)));

		WebhookProcessingResult result = service.processWebhook(mismatch);

		assertThat(result.orderApproved()).isFalse();
		assertThat(fixture.payment().getStatus()).isEqualTo(PaymentStatus.PENDING);
		assertThat(fixture.order().getStatus()).isEqualTo(OrderStatus.QUOTATION_SENT);
		verify(auditLogRepository, never()).saveAndFlush(any());
	}

	@Test
	void mismatchedQuotationMetadataNeverApproves() {
		WebhookFixture fixture = webhookFixture(OrderStatus.QUOTATION_SENT);
		Map<String, String> wrongMetadata = new java.util.HashMap<>(metadata(fixture));
		wrongMetadata.put("quotationId", UUID.randomUUID().toString());
		StripeWebhookEvent mismatch = new StripeWebhookEvent("evt_metadata", "checkout.session.completed",
				StripeEventKind.SUCCESS, "cs_1", "pi_1", 25000L, "usd", wrongMetadata);

		WebhookProcessingResult result = service.processWebhook(mismatch);

		assertThat(result.orderApproved()).isFalse();
		assertThat(fixture.payment().getStatus()).isEqualTo(PaymentStatus.PENDING);
		assertThat(fixture.order().getStatus()).isEqualTo(OrderStatus.QUOTATION_SENT);
		verify(auditLogRepository, never()).saveAndFlush(any());
		verify(documentPhaseStarter, never()).startForOrder(any());
	}

	@Test
	void auditFailureRestoresAllInMemoryBusinessTransitionsForRollback() {
		WebhookFixture fixture = webhookFixture(OrderStatus.QUOTATION_SENT);
		when(auditLogRepository.saveAndFlush(any()))
				.thenThrow(new DataIntegrityViolationException("audit failure"));

		assertThatThrownBy(() -> service.processWebhook(event("evt_rollback", StripeEventKind.SUCCESS, fixture)))
				.isInstanceOf(DataIntegrityViolationException.class);
		assertThat(fixture.payment().getStatus()).isEqualTo(PaymentStatus.PENDING);
		assertThat(fixture.payment().getPaidAt()).isNull();
		assertThat(fixture.order().getStatus()).isEqualTo(OrderStatus.QUOTATION_SENT);
		assertThat(fixture.order().getApprovedAt()).isNull();
		assertThat(fixture.attempt().getProviderStatus()).isEqualTo(PaymentAttemptStatus.OPEN);
		verify(documentPhaseStarter, never()).startForOrder(any());
	}

	@Test
	void documentChecklistFailureRestoresPaymentOrderAndAttemptForTransactionRollback() {
		WebhookFixture fixture = webhookFixture(OrderStatus.QUOTATION_SENT);
		org.mockito.Mockito.doThrow(new DataIntegrityViolationException("checklist failure"))
				.when(documentPhaseStarter).startForOrder(ORDER_ID);

		assertThatThrownBy(() -> service.processWebhook(event("evt_checklist_rollback", StripeEventKind.SUCCESS, fixture)))
				.isInstanceOf(DataIntegrityViolationException.class);
		assertThat(fixture.payment().getStatus()).isEqualTo(PaymentStatus.PENDING);
		assertThat(fixture.payment().getPaidAt()).isNull();
		assertThat(fixture.order().getStatus()).isEqualTo(OrderStatus.QUOTATION_SENT);
		assertThat(fixture.order().getApprovedAt()).isNull();
		assertThat(fixture.attempt().getProviderStatus()).isEqualTo(PaymentAttemptStatus.OPEN);
		verify(auditLogRepository).saveAndFlush(any());
	}

	private void stubCheckoutState(Payment payment, PaymentAttempt attempt) {
		when(orderRepository.findOwnedByIdForUpdate(ORDER_ID, CUSTOMER_ID))
				.thenReturn(Optional.of(order(OrderStatus.QUOTATION_SENT)));
		when(quotationRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(sentQuotation()));
		when(paymentRepository.findByTransportOrderIdAndPaymentType(ORDER_ID, PaymentType.DEPOSIT))
				.thenReturn(Optional.of(payment));
		when(attemptRepository.findFirstByPaymentIdOrderByAttemptNoDesc(payment.getId()))
				.thenReturn(Optional.of(attempt));
	}

	private WebhookFixture webhookFixture(OrderStatus orderStatus) {
		Payment payment = payment();
		PaymentAttempt attempt = attempt(payment);
		attempt.attachCheckoutSession("cs_1", "pi_1");
		TransportOrder order = order(orderStatus);
		Quotation quotation = sentQuotation();
		lenient().when(paymentRepository.findByIdForUpdate(payment.getId())).thenReturn(Optional.of(payment));
		lenient().when(eventRepository.existsByProviderEventId(any())).thenReturn(false);
		lenient().when(attemptRepository.findByIdForUpdate(attempt.getId())).thenReturn(Optional.of(attempt));
		lenient().when(orderRepository.findByIdForUpdate(ORDER_ID)).thenReturn(Optional.of(order));
		lenient().when(quotationRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(quotation));
		return new WebhookFixture(payment, attempt, order, quotation);
	}

	private StripeWebhookEvent event(String eventId, StripeEventKind kind, WebhookFixture fixture) {
		return new StripeWebhookEvent(eventId,
				kind == StripeEventKind.SUCCESS ? "checkout.session.completed" : "checkout.session.ended",
				kind, "cs_1", "pi_1", 25000L, "usd", metadata(fixture));
	}

	private Map<String, String> metadata(WebhookFixture fixture) {
		return Map.of("orderId", ORDER_ID.toString(), "quotationId", QUOTATION_ID.toString(),
				"paymentId", fixture.payment().getId().toString(),
				"paymentAttemptId", fixture.attempt().getId().toString(), "paymentType", "DEPOSIT");
	}

	private String stripeEventPayload(String eventId, String eventType, String objectType, String status,
			WebhookFixture fixture) {
		String object = "payment_intent".equals(objectType)
				? "\"id\":\"pi_1\",\"object\":\"payment_intent\",\"amount\":25000,"
						+ "\"currency\":\"usd\",\"status\":\"" + status + "\""
				: "\"id\":\"cs_1\",\"object\":\"checkout.session\",\"amount_total\":25000,"
						+ "\"currency\":\"usd\",\"payment_intent\":\"pi_1\","
						+ "\"payment_status\":\"" + status + "\",\"status\":\"complete\"";
		Map<String, String> metadata = metadata(fixture);
		return "{\"id\":\"" + eventId + "\",\"object\":\"event\",\"api_version\":\""
				+ Stripe.API_VERSION + "\",\"created\":" + Instant.now().getEpochSecond()
				+ ",\"data\":{\"object\":{" + object + ",\"metadata\":{"
				+ "\"orderId\":\"" + metadata.get("orderId") + "\","
				+ "\"quotationId\":\"" + metadata.get("quotationId") + "\","
				+ "\"paymentId\":\"" + metadata.get("paymentId") + "\","
				+ "\"paymentAttemptId\":\"" + metadata.get("paymentAttemptId") + "\","
				+ "\"paymentType\":\"DEPOSIT\"}}},\"livemode\":false,\"pending_webhooks\":1,"
				+ "\"request\":null,\"type\":\"" + eventType + "\"}";
	}

	private String stripeSignature(String payload, String secret) throws Exception {
		long timestamp = Instant.now().getEpochSecond();
		Mac hmac = Mac.getInstance("HmacSHA256");
		hmac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
		String signedPayload = timestamp + "." + payload;
		String signature = HexFormat.of().formatHex(hmac.doFinal(signedPayload.getBytes(StandardCharsets.UTF_8)));
		return "t=" + timestamp + ",v1=" + signature;
	}

	private Payment payment() {
		return new Payment(ORDER_ID, new BigDecimal("250.00"), "USD");
	}

	private PaymentAttempt attempt(Payment payment) {
		return new PaymentAttempt(payment.getId(), 1);
	}

	private Quotation sentQuotation() {
		try {
			Constructor<Quotation> constructor = Quotation.class.getDeclaredConstructor(UUID.class, UUID.class);
			constructor.setAccessible(true);
			Quotation quotation = constructor.newInstance(ORDER_ID, UUID.randomUUID());
			ReflectionTestUtils.setField(quotation, "id", QUOTATION_ID);
			ReflectionTestUtils.setField(quotation, "depositAmount", new BigDecimal("250.00"));
			ReflectionTestUtils.setField(quotation, "status", QuotationStatus.SENT);
			return quotation;
		}
		catch (ReflectiveOperationException exception) {
			throw new IllegalStateException(exception);
		}
	}

	private TransportOrder order(OrderStatus status) {
		try {
			Constructor<TransportOrder> constructor = TransportOrder.class
					.getDeclaredConstructor(UUID.class, String.class);
			constructor.setAccessible(true);
			TransportOrder order = constructor.newInstance(CUSTOMER_ID, "ORD-test");
			ReflectionTestUtils.setField(order, "id", ORDER_ID);
			ReflectionTestUtils.setField(order, "status", status);
			return order;
		}
		catch (ReflectiveOperationException exception) {
			throw new IllegalStateException(exception);
		}
	}

	private record WebhookFixture(Payment payment, PaymentAttempt attempt, TransportOrder order,
			Quotation quotation) {
	}
}
