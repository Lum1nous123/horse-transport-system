package com.horsetransport.quotation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Constructor;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.horsetransport.audit.AuditActorKind;
import com.horsetransport.audit.AuditEntityType;
import com.horsetransport.audit.StatusAuditLog;
import com.horsetransport.audit.StatusAuditLogRepository;
import com.horsetransport.order.InvalidOrderTransitionException;
import com.horsetransport.order.OrderNotFoundException;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

@ExtendWith(MockitoExtension.class)
class QuotationServiceTest {

	private static final UUID LM_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final UUID CUSTOMER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
	private static final UUID ORDER_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");

	@Mock private QuotationRepository quotationRepository;
	@Mock private TransportOrderRepository orderRepository;
	@Mock private StatusAuditLogRepository auditLogRepository;
	@Mock private CurrentUserProvider currentUserProvider;
	@InjectMocks private QuotationService service;

	@BeforeEach
	void currentManager() {
		lenient().when(currentUserProvider.getCurrentUserId()).thenReturn(LM_ID);
	}

	@Test
	void createsIncompleteDraftForSubmittedOrder() {
		TransportOrder order = order(OrderStatus.SUBMITTED);
		when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));
		when(quotationRepository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));

		QuotationResponse response = service.create(ORDER_ID);

		assertThat(response.status()).isEqualTo(QuotationStatus.DRAFT);
		assertThat(response.currency()).isEqualTo("USD");
		assertThat(response.totalAmount()).isNull();
		assertThat(response.depositAmount()).isNull();
		assertThat(response.remainingAmount()).isNull();
		assertThat(response.lineItems()).isEmpty();
		assertThat(response.createdBy()).isEqualTo(LM_ID);
	}

	@Test
	void rejectsDuplicateQuotation() {
		when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order(OrderStatus.SUBMITTED)));
		when(quotationRepository.existsByTransportOrderId(ORDER_ID)).thenReturn(true);

		assertThatThrownBy(() -> service.create(ORDER_ID)).isInstanceOf(DuplicateQuotationException.class);
		verify(quotationRepository, never()).saveAndFlush(any());
	}

	@Test
	void createsOnlyForSubmittedOrder() {
		when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order(OrderStatus.DRAFT)));

		assertThatThrownBy(() -> service.create(ORDER_ID)).isInstanceOf(InvalidOrderTransitionException.class);
	}

	@Test
	void replacesLineItemsAndCalculatesAmounts() {
		Quotation quotation = quotation();
		stubDraft(quotation);

		QuotationResponse first = service.update(ORDER_ID, request("300.00",
				item(1, "Road", "800.00"), item(2, "Air", "700.00")));
		QuotationResponse second = service.update(ORDER_ID, request("200.00",
				item(1, "Updated road", "900.00")));

		assertThat(first.totalAmount()).isEqualByComparingTo("1500.00");
		assertThat(first.remainingAmount()).isEqualByComparingTo("1200.00");
		assertThat(second.totalAmount()).isEqualByComparingTo("900.00");
		assertThat(second.remainingAmount()).isEqualByComparingTo("700.00");
		assertThat(second.lineItems()).singleElement().satisfies(item -> {
			assertThat(item.description()).isEqualTo("Updated road");
			assertThat(item.amount()).isEqualByComparingTo("900.00");
		});
	}

	@Test
	void allowsIncompleteDraft() {
		Quotation quotation = quotation();
		stubDraft(quotation);

		QuotationResponse response = service.update(ORDER_ID, new UpdateQuotationRequest(null, null, null));

		assertThat(response.totalAmount()).isNull();
		assertThat(response.remainingAmount()).isNull();
		assertThat(response.lineItems()).isEmpty();
	}

	@Test
	void rejectsNonPositiveAmountAndDuplicateSequence() {
		Quotation quotation = quotation();
		stubDraft(quotation);

		assertThatThrownBy(() -> service.update(ORDER_ID, request(null, item(1, "Road", "0"))))
				.isInstanceOf(QuotationValidationException.class).hasMessageContaining("amount");
		assertThatThrownBy(() -> service.update(ORDER_ID, request(null,
				item(1, "Road", "10"), item(1, "Air", "20"))))
				.isInstanceOf(QuotationValidationException.class).hasMessageContaining("unique");
	}

	@Test
	void rejectsInvalidDepositInDraft() {
		Quotation quotation = quotation();
		stubDraft(quotation);

		assertThatThrownBy(() -> service.update(ORDER_ID, request("100.00", item(1, "Road", "100.00"))))
				.isInstanceOf(QuotationValidationException.class).hasMessageContaining("depositAmount");
	}

	@Test
	void sendsQuotationAndOrderWithTwoCorrectAudits() {
		Quotation quotation = validQuotation();
		TransportOrder order = order(OrderStatus.SUBMITTED);
		when(quotationRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(quotation));
		when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));

		QuotationResponse response = service.send(ORDER_ID);

		assertThat(response.status()).isEqualTo(QuotationStatus.SENT);
		assertThat(response.sentAt()).isNotNull();
		assertThat(order.getStatus()).isEqualTo(OrderStatus.QUOTATION_SENT);
		@SuppressWarnings("unchecked")
		ArgumentCaptor<List<StatusAuditLog>> captor = ArgumentCaptor.forClass(List.class);
		verify(auditLogRepository).saveAllAndFlush(captor.capture());
		assertThat(captor.getValue()).hasSize(2);
		assertAudit(captor.getValue().get(0), AuditEntityType.QUOTATION, quotation.getId(), "DRAFT", "SENT");
		assertAudit(captor.getValue().get(1), AuditEntityType.TRANSPORT_ORDER, ORDER_ID,
				"SUBMITTED", "QUOTATION_SENT");
	}

	@Test
	void rejectsSendingIncompleteDraft() {
		Quotation quotation = quotation();
		when(quotationRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(quotation));
		when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order(OrderStatus.SUBMITTED)));

		assertThatThrownBy(() -> service.send(ORDER_ID))
				.isInstanceOf(QuotationValidationException.class)
				.hasMessageContaining("line item");
		verify(auditLogRepository, never()).saveAllAndFlush(any());
	}

	@Test
	void auditFailureRestoresQuotationAndOrderForTransactionRollback() {
		Quotation quotation = validQuotation();
		TransportOrder order = order(OrderStatus.SUBMITTED);
		when(quotationRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(quotation));
		when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));
		when(auditLogRepository.saveAllAndFlush(any()))
				.thenThrow(new DataIntegrityViolationException("audit insert failed"));

		assertThatThrownBy(() -> service.send(ORDER_ID)).isInstanceOf(DataIntegrityViolationException.class);
		assertThat(quotation.getStatus()).isEqualTo(QuotationStatus.DRAFT);
		assertThat(quotation.getSentAt()).isNull();
		assertThat(order.getStatus()).isEqualTo(OrderStatus.SUBMITTED);
	}

	@Test
	void persistenceFailureRestoresQuotationAndOrderForTransactionRollback() {
		Quotation quotation = validQuotation();
		TransportOrder order = order(OrderStatus.SUBMITTED);
		when(quotationRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(quotation));
		when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));
		when(orderRepository.save(order)).thenThrow(new DataIntegrityViolationException("order update failed"));

		assertThatThrownBy(() -> service.send(ORDER_ID)).isInstanceOf(DataIntegrityViolationException.class);
		assertThat(quotation.getStatus()).isEqualTo(QuotationStatus.DRAFT);
		assertThat(quotation.getSentAt()).isNull();
		assertThat(order.getStatus()).isEqualTo(OrderStatus.SUBMITTED);
		verify(auditLogRepository, never()).saveAllAndFlush(any());
	}

	@Test
	void sentQuotationIsImmutableAndCannotBeResent() {
		Quotation quotation = validQuotation();
		quotation.send();
		when(quotationRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(quotation));
		when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order(OrderStatus.QUOTATION_SENT)));

		assertThatThrownBy(() -> service.update(ORDER_ID, new UpdateQuotationRequest(null, null, null)))
				.isInstanceOf(QuotationNotEditableException.class);
		assertThatThrownBy(() -> service.send(ORDER_ID)).isInstanceOf(QuotationNotEditableException.class);
	}

	@Test
	void managerGetsDraftAndSentQuotation() {
		Quotation quotation = quotation();
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.LOGISTICS_MANAGER);
		when(quotationRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(quotation));

		assertThat(service.get(ORDER_ID).status()).isEqualTo(QuotationStatus.DRAFT);
		quotation.send();
		assertThat(service.get(ORDER_ID).status()).isEqualTo(QuotationStatus.SENT);
	}

	@Test
	void customerGetsOnlyOwnedSentQuotation() {
		Quotation quotation = validQuotation();
		quotation.send();
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.CUSTOMER);
		when(currentUserProvider.getCurrentUserId()).thenReturn(CUSTOMER_ID);
		when(orderRepository.findByIdAndCustomerId(ORDER_ID, CUSTOMER_ID))
				.thenReturn(Optional.of(order(OrderStatus.QUOTATION_SENT)));
		when(quotationRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(quotation));

		assertThat(service.get(ORDER_ID).status()).isEqualTo(QuotationStatus.SENT);
	}

	@Test
	void customerCannotSeeDraftOrAnotherCustomersQuotation() {
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.CUSTOMER);
		when(currentUserProvider.getCurrentUserId()).thenReturn(CUSTOMER_ID);
		when(orderRepository.findByIdAndCustomerId(ORDER_ID, CUSTOMER_ID))
				.thenReturn(Optional.of(order(OrderStatus.SUBMITTED)));
		when(quotationRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(quotation()));

		assertThatThrownBy(() -> service.get(ORDER_ID)).isInstanceOf(QuotationNotFoundException.class);

		when(orderRepository.findByIdAndCustomerId(ORDER_ID, CUSTOMER_ID)).thenReturn(Optional.empty());
		assertThatThrownBy(() -> service.get(ORDER_ID)).isInstanceOf(OrderNotFoundException.class);
	}

	@Test
	void sendMethodDefinesTransactionBoundary() throws Exception {
		Transactional transactional = QuotationService.class.getMethod("send", UUID.class)
				.getAnnotation(Transactional.class);
		assertThat(transactional).isNotNull();
	}

	private void stubDraft(Quotation quotation) {
		when(quotationRepository.findByTransportOrderId(ORDER_ID)).thenReturn(Optional.of(quotation));
		when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order(OrderStatus.SUBMITTED)));
		lenient().when(quotationRepository.save(quotation)).thenReturn(quotation);
	}

	private Quotation validQuotation() {
		Quotation quotation = quotation();
		quotation.replace(request("200.00", item(1, "Road", "1000.00")));
		return quotation;
	}

	private Quotation quotation() {
		return new Quotation(ORDER_ID, LM_ID);
	}

	private UpdateQuotationRequest request(String deposit, QuotationLineItemRequest... items) {
		return new UpdateQuotationRequest(deposit == null ? null : new BigDecimal(deposit), " Notes ",
				List.of(items));
	}

	private QuotationLineItemRequest item(int sequence, String description, String amount) {
		return new QuotationLineItemRequest(sequence, description, new BigDecimal(amount));
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

	private void assertAudit(StatusAuditLog audit, AuditEntityType entityType, UUID entityId,
			String oldStatus, String newStatus) {
		assertThat(audit.getEntityType()).isEqualTo(entityType);
		assertThat(audit.getEntityId()).isEqualTo(entityId);
		assertThat(audit.getOldStatus()).isEqualTo(oldStatus);
		assertThat(audit.getNewStatus()).isEqualTo(newStatus);
		assertThat(audit.getActorKind()).isEqualTo(AuditActorKind.USER);
		assertThat(audit.getActorUserId()).isEqualTo(LM_ID);
		assertThat(audit.getReason()).isNull();
	}
}
