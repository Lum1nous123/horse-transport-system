package com.horsetransport.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.horsetransport.audit.AuditActorKind;
import com.horsetransport.audit.AuditEntityType;
import com.horsetransport.audit.StatusAuditLog;
import com.horsetransport.audit.StatusAuditLogRepository;
import com.horsetransport.horse.Horse;
import com.horsetransport.horse.HorseRepository;
import com.horsetransport.security.CurrentUserProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

@ExtendWith(MockitoExtension.class)
class TransportOrderServiceTest {

	private static final UUID CUSTOMER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final UUID ORDER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
	private static final UUID HORSE_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");

	@Mock private TransportOrderRepository orderRepository;
	@Mock private HorseRepository horseRepository;
	@Mock private StatusAuditLogRepository auditLogRepository;
	@Mock private CurrentUserProvider currentUserProvider;
	@InjectMocks private TransportOrderService service;

	@BeforeEach
	void currentCustomer() {
		lenient().when(currentUserProvider.getCurrentUserId()).thenReturn(CUSTOMER_ID);
	}

	@Test
	void createsIncompleteDraftWithBackendGeneratedOrderCode() {
		when(orderRepository.save(any(TransportOrder.class))).thenAnswer(invocation -> invocation.getArgument(0));

		OrderResponse response = service.create(emptyRequest());

		assertThat(response.status()).isEqualTo(OrderStatus.DRAFT);
		assertThat(response.orderCode()).startsWith("ORD-").hasSizeLessThanOrEqualTo(30);
		assertThat(response.horseIds()).isEmpty();
		assertThat(response.originAddress()).isNull();
	}

	@Test
	void rejectsDuplicateHorse() {
		UpdateOrderRequest request = request(List.of(HORSE_ID, HORSE_ID));

		assertThatThrownBy(() -> service.create(request))
				.isInstanceOf(InvalidOrderHorsesException.class)
				.hasMessageContaining("more than once");
		verify(horseRepository, never()).findAllByIdInAndCustomerId(any(), any());
	}

	@Test
	void rejectsNonexistentOrCrossOwnerHorse() {
		when(horseRepository.findAllByIdInAndCustomerId(any(), any())).thenReturn(List.of());

		assertThatThrownBy(() -> service.create(request(List.of(HORSE_ID))))
				.isInstanceOf(InvalidOrderHorsesException.class)
				.hasMessageContaining("belong to the current customer");
	}

	@Test
	void editsDraftAndReplacesHorseSelection() {
		TransportOrder order = order();
		when(orderRepository.findByIdAndCustomerId(order.getId(), CUSTOMER_ID)).thenReturn(Optional.of(order));
		when(horseRepository.findAllByIdInAndCustomerId(any(), any())).thenReturn(List.of(mock(Horse.class)));
		when(orderRepository.save(order)).thenReturn(order);

		OrderResponse response = service.update(order.getId(), request(List.of(HORSE_ID)));

		assertThat(response.originAddress()).isEqualTo("Hanoi");
		assertThat(response.horseIds()).containsExactly(HORSE_ID);
	}

	@Test
	void editingDraftRetainsExistingHorseWithoutDuplicatingIt() {
		TransportOrder order = validOrder();
		when(orderRepository.findByIdAndCustomerId(order.getId(), CUSTOMER_ID)).thenReturn(Optional.of(order));
		when(horseRepository.findAllByIdInAndCustomerId(any(), any())).thenReturn(List.of(mock(Horse.class)));
		when(orderRepository.save(order)).thenReturn(order);

		OrderResponse response = service.update(order.getId(), request(List.of(HORSE_ID)));

		assertThat(response.horseIds()).containsExactly(HORSE_ID);
		assertThat(order.getHorses()).hasSize(1);
	}

	@Test
	void rejectsEditingSubmittedOrder() {
		TransportOrder order = order();
		order.submit();
		when(orderRepository.findByIdAndCustomerId(order.getId(), CUSTOMER_ID)).thenReturn(Optional.of(order));

		assertThatThrownBy(() -> service.update(order.getId(), emptyRequest()))
				.isInstanceOf(OrderNotEditableException.class);
	}

	@Test
	void submitRejectsOnlyMissingConfirmedBusinessFields() {
		TransportOrder order = order();
		when(orderRepository.findByIdAndCustomerId(order.getId(), CUSTOMER_ID)).thenReturn(Optional.of(order));

		assertThatThrownBy(() -> service.submit(order.getId()))
				.isInstanceOf(OrderSubmissionValidationException.class)
				.hasMessageContaining("origin, destination, requestedDepartureAt, transportMode, horseIds, recipientName, recipientPhone");
		assertThat(order.getStatus()).isEqualTo(OrderStatus.DRAFT);
	}

	@Test
	void submitAllowsAddressWithoutCountryAndCreatesAudit() {
		TransportOrder order = validOrder();
		when(orderRepository.findByIdAndCustomerId(order.getId(), CUSTOMER_ID)).thenReturn(Optional.of(order));
		when(auditLogRepository.saveAndFlush(any(StatusAuditLog.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		OrderResponse response = service.submit(order.getId());

		assertThat(response.status()).isEqualTo(OrderStatus.SUBMITTED);
		ArgumentCaptor<StatusAuditLog> captor = ArgumentCaptor.forClass(StatusAuditLog.class);
		verify(auditLogRepository).saveAndFlush(captor.capture());
		StatusAuditLog audit = captor.getValue();
		assertThat(audit.getEntityType()).isEqualTo(AuditEntityType.TRANSPORT_ORDER);
		assertThat(audit.getEntityId()).isEqualTo(order.getId());
		assertThat(audit.getOldStatus()).isEqualTo("DRAFT");
		assertThat(audit.getNewStatus()).isEqualTo("SUBMITTED");
		assertThat(audit.getActorKind()).isEqualTo(AuditActorKind.USER);
		assertThat(audit.getActorUserId()).isEqualTo(CUSTOMER_ID);
	}

	@Test
	void auditFailurePropagatesAndRestoresDraftForTransactionRollback() {
		TransportOrder order = validOrder();
		when(orderRepository.findByIdAndCustomerId(order.getId(), CUSTOMER_ID)).thenReturn(Optional.of(order));
		when(auditLogRepository.saveAndFlush(any(StatusAuditLog.class)))
				.thenThrow(new DataIntegrityViolationException("audit insert failed"));

		assertThatThrownBy(() -> service.submit(order.getId()))
				.isInstanceOf(DataIntegrityViolationException.class);
		assertThat(order.getStatus()).isEqualTo(OrderStatus.DRAFT);
	}

	@Test
	void submitMethodDefinesTransactionBoundary() throws Exception {
		Transactional transactional = TransportOrderService.class.getMethod("submit", UUID.class)
				.getAnnotation(Transactional.class);
		assertThat(transactional).isNotNull();
	}

	@Test
	void listIsScopedToCurrentCustomer() {
		TransportOrder order = order();
		when(orderRepository.findAllByCustomerIdOrderByCreatedAtDesc(CUSTOMER_ID)).thenReturn(List.of(order));

		assertThat(service.findCurrentCustomerOrders()).hasSize(1);
		verify(orderRepository).findAllByCustomerIdOrderByCreatedAtDesc(CUSTOMER_ID);
	}

	@Test
	void detailForAnotherCustomerReturnsNotFound() {
		when(orderRepository.findByIdAndCustomerId(ORDER_ID, CUSTOMER_ID)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.findCurrentCustomerOrder(ORDER_ID))
				.isInstanceOf(OrderNotFoundException.class);
	}

	private TransportOrder validOrder() {
		TransportOrder order = order();
		order.update(request(List.of(HORSE_ID)), List.of(HORSE_ID));
		return order;
	}

	private TransportOrder order() {
		return new TransportOrder(CUSTOMER_ID, "ORD-test");
	}

	private UpdateOrderRequest emptyRequest() {
		return new UpdateOrderRequest(null, null, null, null, null, null,
				null, null, null, null, null);
	}

	private UpdateOrderRequest request(List<UUID> horseIds) {
		return new UpdateOrderRequest("Hanoi", null, "Da Nang", null,
				LocalDateTime.of(2026, 10, 1, 9, 0), TransportMode.ROAD,
				null, "Nguyen Van A", "0901234567", null, horseIds);
	}
}
