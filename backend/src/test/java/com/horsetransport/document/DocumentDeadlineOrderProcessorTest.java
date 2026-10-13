package com.horsetransport.document;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.horsetransport.audit.AuditEntityType;
import com.horsetransport.audit.StatusAuditLog;
import com.horsetransport.audit.StatusAuditLogRepository;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderHorse;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.payment.DepositRefund;
import com.horsetransport.payment.DepositRefundRepository;
import com.horsetransport.payment.Payment;
import com.horsetransport.payment.PaymentRepository;
import com.horsetransport.payment.PaymentStatus;
import com.horsetransport.payment.PaymentType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DocumentDeadlineOrderProcessorTest {

	private static final UUID ORDER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final UUID HORSE_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
	private static final UUID PAYMENT_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
	private static final LocalDateTime DEADLINE = LocalDateTime.of(2026, 10, 4, 12, 0);

	@Mock private TransportOrderRepository orderRepository;
	@Mock private HorseDocumentRepository documentRepository;
	@Mock private HorseDocumentVersionRepository versionRepository;
	@Mock private PaymentRepository paymentRepository;
	@Mock private DepositRefundRepository refundRepository;
	@Mock private StatusAuditLogRepository auditRepository;
	@Mock private TransportOrder order;
	@Mock private TransportOrderHorse orderHorse;
	@Mock private Payment payment;

	private List<HorseDocument> documents;
	private List<HorseDocumentVersion> versions;
	private DocumentDeadlineOrderProcessor processor;

	@BeforeEach
	void setUp() {
		processor = new DocumentDeadlineOrderProcessor(orderRepository, documentRepository,
				versionRepository, paymentRepository, refundRepository, auditRepository);
		when(orderRepository.findByIdForUpdate(ORDER_ID)).thenReturn(Optional.of(order));
		when(order.getId()).thenReturn(ORDER_ID);
		when(order.getStatus()).thenReturn(OrderStatus.APPROVED);
		when(order.getDocumentCompletionDeadlineAt()).thenReturn(DEADLINE);
		when(order.getDocumentsLockedAt()).thenReturn(null);
		when(order.getDocumentsFinalConfirmedAt()).thenReturn(null);
		when(order.getHorses()).thenReturn(List.of(orderHorse));
		when(orderHorse.getId()).thenReturn(HORSE_ID);
		when(documentRepository.findAllByOrderHorseIds(anyCollection())).thenAnswer(invocation -> documents);
		when(versionRepository.findCurrentByHorseDocumentIds(anyCollection())).thenAnswer(invocation -> versions);
		when(paymentRepository.findByTransportOrderIdAndPaymentType(ORDER_ID, PaymentType.DEPOSIT))
				.thenReturn(Optional.of(payment));
		when(payment.getId()).thenReturn(PAYMENT_ID);
		when(payment.getStatus()).thenReturn(PaymentStatus.PAID);
		when(refundRepository.findByPaymentId(PAYMENT_ID)).thenReturn(Optional.empty());
		when(refundRepository.saveAndFlush(any(DepositRefund.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		documents = new ArrayList<>();
		versions = new ArrayList<>();
		for (DocumentType type : DocumentType.values()) {
			HorseDocument document = org.mockito.Mockito.mock(HorseDocument.class);
			UUID documentId = UUID.randomUUID();
			when(document.getId()).thenReturn(documentId);
			when(document.getDocumentType()).thenReturn(type);
			when(document.getTransportOrderHorseId()).thenReturn(HORSE_ID);
			documents.add(document);
			HorseDocumentVersion version = org.mockito.Mockito.mock(HorseDocumentVersion.class);
			when(version.getHorseDocumentId()).thenReturn(documentId);
			when(version.getStatus()).thenReturn(DocumentVersionStatus.APPROVED);
			versions.add(version);
		}
	}

	@Test
	void cancelsAtDeadlineForDraftAndPersistsAuditAndRefundIntent() {
		when(versions.getFirst().getStatus()).thenReturn(DocumentVersionStatus.DRAFT);

		assertThat(processor.cancelForIncompleteDeadline(ORDER_ID, DEADLINE)).isTrue();

		verify(order).cancelForDocumentDeadline(DEADLINE);
		verify(orderRepository).saveAndFlush(order);
		ArgumentCaptor<StatusAuditLog> audit = ArgumentCaptor.forClass(StatusAuditLog.class);
		verify(auditRepository).saveAndFlush(audit.capture());
		assertThat(audit.getValue().getEntityType()).isEqualTo(AuditEntityType.TRANSPORT_ORDER);
		assertThat(audit.getValue().getOldStatus()).isEqualTo("APPROVED");
		assertThat(audit.getValue().getNewStatus()).isEqualTo("CANCELLED");
		assertThat(audit.getValue().getOccurredAt()).isEqualTo(DEADLINE);
		ArgumentCaptor<DepositRefund> refund = ArgumentCaptor.forClass(DepositRefund.class);
		verify(refundRepository).saveAndFlush(refund.capture());
		assertThat(refund.getValue().getPaymentId()).isEqualTo(PAYMENT_ID);
		assertThat(refund.getValue().getIdempotencyKey()).isEqualTo("document-deadline-refund-" + PAYMENT_ID);
		assertThat(refund.getValue().getRequestedAt()).isEqualTo(DEADLINE);
	}

	@Test
	void doesNotCancelWhenAllSubmittedDocumentsArePendingReview() {
		when(versions.getFirst().getStatus()).thenReturn(DocumentVersionStatus.PENDING_REVIEW);

		assertThat(processor.cancelForIncompleteDeadline(ORDER_ID, DEADLINE)).isFalse();

		verify(orderRepository, never()).saveAndFlush(any());
		verify(auditRepository, never()).saveAndFlush(any());
		verify(refundRepository, never()).saveAndFlush(any());
	}

	@Test
	void cancelsAtDeadlineWhenCurrentDocumentRemainsRejected() {
		when(versions.getFirst().getStatus()).thenReturn(DocumentVersionStatus.REJECTED);

		assertThat(processor.cancelForIncompleteDeadline(ORDER_ID, DEADLINE)).isTrue();

		verify(order).cancelForDocumentDeadline(DEADLINE);
		verify(refundRepository).saveAndFlush(any(DepositRefund.class));
	}

	@Test
	void cancelsWhenAMandatoryDocumentRecordIsMissing() {
		documents.removeLast();

		assertThat(processor.cancelForIncompleteDeadline(ORDER_ID, DEADLINE)).isTrue();

		verify(order).cancelForDocumentDeadline(DEADLINE);
	}

	@Test
	void doesNotCancelAllApprovedDocumentsAwaitingFinalConfirm() {
		assertThat(processor.cancelForIncompleteDeadline(ORDER_ID, DEADLINE)).isFalse();

		verify(orderRepository, never()).saveAndFlush(any());
		verify(refundRepository, never()).saveAndFlush(any());
	}

	@Test
	void doesNotCancelBeforeDeadlineOrAfterFinalConfirm() {
		assertThat(processor.cancelForIncompleteDeadline(ORDER_ID, DEADLINE.minusNanos(1))).isFalse();
		when(order.getDocumentsFinalConfirmedAt()).thenReturn(DEADLINE.minusMinutes(1));
		when(versions.getFirst().getStatus()).thenReturn(DocumentVersionStatus.DRAFT);
		assertThat(processor.cancelForIncompleteDeadline(ORDER_ID, DEADLINE)).isFalse();
		verify(documentRepository, never()).findAllByOrderHorseIds(anyCollection());
	}

	@Test
	void rejectionAfterDeadlineCancelsAndCreatesRefundIntent() {
		LocalDateTime rejectedAt = DEADLINE.plusSeconds(1);

		assertThat(processor.cancelForPostDeadlineRejection(ORDER_ID, rejectedAt)).isTrue();

		verify(order).cancelForDocumentDeadline(rejectedAt);
		verify(auditRepository).saveAndFlush(any(StatusAuditLog.class));
		verify(refundRepository).saveAndFlush(any(DepositRefund.class));
	}

	@Test
	void retryDoesNotRepeatCancellationAuditOrRefundIntentAfterOrderIsCancelled() {
		when(versions.getFirst().getStatus()).thenReturn(DocumentVersionStatus.DRAFT);
		when(order.getStatus()).thenReturn(OrderStatus.APPROVED, OrderStatus.APPROVED, OrderStatus.CANCELLED);
		assertThat(processor.cancelForIncompleteDeadline(ORDER_ID, DEADLINE)).isTrue();
		assertThat(processor.cancelForIncompleteDeadline(ORDER_ID, DEADLINE)).isFalse();
		verify(auditRepository, times(1)).saveAndFlush(any(StatusAuditLog.class));
		verify(refundRepository, times(1)).saveAndFlush(any(DepositRefund.class));
	}
}
