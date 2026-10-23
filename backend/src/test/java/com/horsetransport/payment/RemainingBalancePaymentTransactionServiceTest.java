package com.horsetransport.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Constructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.horsetransport.notification.NotificationService;
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
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class RemainingBalancePaymentTransactionServiceTest {

	private static final UUID CUSTOMER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final UUID ORDER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
	private static final UUID QUOTATION_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");

	@Mock private PaymentRepository paymentRepository;
	@Mock private PaymentAttemptRepository attemptRepository;
	@Mock private PaymentProviderEventRepository eventRepository;
	@Mock private TransportOrderRepository orderRepository;
	@Mock private QuotationRepository quotationRepository;
	@Mock private CurrentUserProvider currentUserProvider;
	@Mock private NotificationService notificationService;

	private RemainingBalancePaymentTransactionService service;

	@BeforeEach
	void setUp() {
		service = new RemainingBalancePaymentTransactionService(paymentRepository, attemptRepository, eventRepository,
				orderRepository, quotationRepository, currentUserProvider, notificationService);
		lenient().when(currentUserProvider.getCurrentUserId()).thenReturn(CUSTOMER_ID);
	}

	@Test
	void ownedCustomerCreatesPendingRemainingBalanceFromServerSideQuotationValuesAfterFinalConfirm() {
		TransportOrder order = finalConfirmedOrder();
		Quotation quotation = sentQuotation();
		when(orderRepository.findOwnedByIdForUpdate(ORDER_ID, CUSTOMER_ID)).thenReturn(Optional.of(order));
		when(quotationRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(quotation));
		when(paymentRepository.findByTransportOrderIdAndPaymentType(ORDER_ID, PaymentType.REMAINING_BALANCE))
				.thenReturn(Optional.empty());
		when(paymentRepository.saveAndFlush(any(Payment.class))).thenAnswer(invocation -> invocation.getArgument(0));
		when(attemptRepository.findFirstByPaymentIdOrderByAttemptNoDesc(any())).thenReturn(Optional.empty());
		when(attemptRepository.saveAndFlush(any(PaymentAttempt.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		PreparedRemainingBalanceCheckout prepared = service.prepareCheckout(ORDER_ID);

		assertThat(prepared.payment().getPaymentType()).isEqualTo(PaymentType.REMAINING_BALANCE);
		assertThat(prepared.payment().getAmount()).isEqualByComparingTo("750.00");
		assertThat(prepared.command().currency()).isEqualTo("USD");
		assertThat(prepared.command().metadata()).containsEntry("orderId", ORDER_ID.toString())
				.containsEntry("quotationId", QUOTATION_ID.toString())
				.containsEntry("paymentType", PaymentType.REMAINING_BALANCE.name());
	}

	@Test
	void checkoutRequiresCustomerOwnershipApprovedStatusAndBe11FinalConfirmMarker() {
		when(orderRepository.findOwnedByIdForUpdate(ORDER_ID, CUSTOMER_ID)).thenReturn(Optional.empty());
		assertThatThrownBy(() -> service.prepareCheckout(ORDER_ID)).isInstanceOf(OrderNotFoundException.class);

		when(orderRepository.findOwnedByIdForUpdate(ORDER_ID, CUSTOMER_ID))
				.thenReturn(Optional.of(order(OrderStatus.APPROVED, null)));
		assertThatThrownBy(() -> service.prepareCheckout(ORDER_ID))
				.isInstanceOf(DepositPaymentConflictException.class)
				.hasMessageContaining("Final Confirmed");

		when(orderRepository.findOwnedByIdForUpdate(ORDER_ID, CUSTOMER_ID))
				.thenReturn(Optional.of(order(OrderStatus.QUOTATION_SENT, LocalDateTime.now())));
		assertThatThrownBy(() -> service.prepareCheckout(ORDER_ID))
				.isInstanceOf(DepositPaymentConflictException.class)
				.hasMessageContaining("Final Confirmed");
	}

	@Test
	void successMarksRemainingBalancePaidWithoutMutatingOrderStateOrFrcEligibleFlag() {
		WebhookFixture fixture = webhookFixture();

		WebhookProcessingResult result = service.processWebhook(event("evt_success", 75000L, "usd", metadata(fixture)));

		assertThat(result.processed()).isTrue();
		assertThat(result.orderApproved()).isFalse();
		assertThat(fixture.payment().getStatus()).isEqualTo(PaymentStatus.PAID);
		assertThat(fixture.payment().getPaidAt()).isNotNull();
		assertThat(fixture.attempt().getProviderStatus()).isEqualTo(PaymentAttemptStatus.SUCCEEDED);
		assertThat(fixture.order().getStatus()).isEqualTo(OrderStatus.APPROVED);
		verify(orderRepository, never()).save(any());
		verify(notificationService).createPaymentResult(CUSTOMER_ID, ORDER_ID,
				fixture.payment().getId(), PaymentType.REMAINING_BALANCE);
	}

	@Test
	void duplicateWebhookHasNoRepeatedSideEffects() {
		WebhookFixture fixture = webhookFixture();
		when(eventRepository.existsByProviderEventId("evt_duplicate")).thenReturn(true);

		WebhookProcessingResult result = service.processWebhook(
				event("evt_duplicate", 75000L, "usd", metadata(fixture)));

		assertThat(result.duplicate()).isTrue();
		assertThat(fixture.payment().getStatus()).isEqualTo(PaymentStatus.PENDING);
		assertThat(fixture.attempt().getProviderStatus()).isEqualTo(PaymentAttemptStatus.OPEN);
		verify(paymentRepository, never()).save(any());
		verify(attemptRepository, never()).save(any());
		verify(notificationService, never()).createPaymentResult(any(), any(), any(), any());
	}

	@Test
	void mismatchedAmountCurrencyOrQuotationMetadataRejectsWebhookWithoutPaying() {
		WebhookFixture fixture = webhookFixture();
		Map<String, String> wrongMetadata = new java.util.HashMap<>(metadata(fixture));
		wrongMetadata.put("quotationId", UUID.randomUUID().toString());

		WebhookProcessingResult result = service.processWebhook(event("evt_mismatch", 1L, "eur", wrongMetadata));

		assertThat(result.processed()).isTrue();
		assertThat(result.orderApproved()).isFalse();
		assertThat(fixture.payment().getStatus()).isEqualTo(PaymentStatus.PENDING);
		assertThat(fixture.attempt().getProviderStatus()).isEqualTo(PaymentAttemptStatus.OPEN);
		ArgumentCaptor<PaymentProviderEvent> eventCaptor = ArgumentCaptor.forClass(PaymentProviderEvent.class);
		verify(eventRepository).saveAndFlush(eventCaptor.capture());
		assertThat(eventCaptor.getValue().getProcessingError()).isNotBlank();
		verify(paymentRepository, never()).save(any());
		verify(attemptRepository, never()).save(any());
	}

	private WebhookFixture webhookFixture() {
		Payment payment = Payment.remainingBalance(ORDER_ID, new BigDecimal("750.00"), "USD");
		PaymentAttempt attempt = new PaymentAttempt(payment.getId(), PaymentType.REMAINING_BALANCE, 1);
		attempt.attachCheckoutSession("cs_remaining", "pi_remaining");
		TransportOrder order = finalConfirmedOrder();
		Quotation quotation = sentQuotation();
		lenient().when(paymentRepository.findByIdForUpdate(payment.getId())).thenReturn(Optional.of(payment));
		lenient().when(eventRepository.existsByProviderEventId(any())).thenReturn(false);
		lenient().when(attemptRepository.findByIdForUpdate(attempt.getId())).thenReturn(Optional.of(attempt));
		lenient().when(orderRepository.findByIdForUpdate(ORDER_ID)).thenReturn(Optional.of(order));
		lenient().when(quotationRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(quotation));
		return new WebhookFixture(payment, attempt, order, quotation);
	}

	private StripeWebhookEvent event(String eventId, Long amountMinor, String currency, Map<String, String> metadata) {
		return new StripeWebhookEvent(eventId, "checkout.session.completed", StripeEventKind.SUCCESS,
				"cs_remaining", "pi_remaining", amountMinor, currency, metadata);
	}

	private Map<String, String> metadata(WebhookFixture fixture) {
		return Map.of("orderId", ORDER_ID.toString(), "quotationId", QUOTATION_ID.toString(),
				"paymentId", fixture.payment().getId().toString(),
				"paymentAttemptId", fixture.attempt().getId().toString(),
				"paymentType", PaymentType.REMAINING_BALANCE.name());
	}

	private TransportOrder finalConfirmedOrder() {
		return order(OrderStatus.APPROVED, LocalDateTime.now());
	}

	private TransportOrder order(OrderStatus status, LocalDateTime documentsLockedAt) {
		try {
			Constructor<TransportOrder> constructor = TransportOrder.class
					.getDeclaredConstructor(UUID.class, String.class);
			constructor.setAccessible(true);
			TransportOrder order = constructor.newInstance(CUSTOMER_ID, "ORD-test");
			ReflectionTestUtils.setField(order, "id", ORDER_ID);
			ReflectionTestUtils.setField(order, "status", status);
			ReflectionTestUtils.setField(order, "documentsLockedAt", documentsLockedAt);
			return order;
		}
		catch (ReflectiveOperationException exception) {
			throw new IllegalStateException(exception);
		}
	}

	private Quotation sentQuotation() {
		try {
			Constructor<Quotation> constructor = Quotation.class.getDeclaredConstructor(UUID.class, UUID.class);
			constructor.setAccessible(true);
			Quotation quotation = constructor.newInstance(ORDER_ID, UUID.randomUUID());
			ReflectionTestUtils.setField(quotation, "id", QUOTATION_ID);
			ReflectionTestUtils.setField(quotation, "totalAmount", new BigDecimal("1000.00"));
			ReflectionTestUtils.setField(quotation, "depositAmount", new BigDecimal("250.00"));
			ReflectionTestUtils.setField(quotation, "remainingAmount", new BigDecimal("750.00"));
			ReflectionTestUtils.setField(quotation, "currency", "USD");
			ReflectionTestUtils.setField(quotation, "status", QuotationStatus.SENT);
			return quotation;
		}
		catch (ReflectiveOperationException exception) {
			throw new IllegalStateException(exception);
		}
	}

	private record WebhookFixture(Payment payment, PaymentAttempt attempt, TransportOrder order,
			Quotation quotation) {
	}
}
