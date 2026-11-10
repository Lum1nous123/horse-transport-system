package com.horsetransport.document;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
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
import com.horsetransport.notification.NotificationService;
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
	private static final UUID CUSTOMER_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
	private static final LocalDateTime DEADLINE = LocalDateTime.of(2026, 10, 4, 12, 0);

	@Mock private TransportOrderRepository orderRepository;
	@Mock private HorseDocumentRepository documentRepository;
	@Mock private HorseDocumentVersionRepository versionRepository;
	@Mock private PaymentRepository paymentRepository;
	@Mock private StatusAuditLogRepository auditRepository;
	@Mock private NotificationService notificationService;
	@Mock private TransportOrder order;
	@Mock private TransportOrderHorse orderHorse;
	@Mock private Payment payment;

	private List<HorseDocument> documents;
	private List<HorseDocumentVersion> versions;
	private DocumentDeadlineOrderProcessor processor;

	@BeforeEach
	void setUp() {
		processor = new DocumentDeadlineOrderProcessor(orderRepository, documentRepository,
				versionRepository, paymentRepository, auditRepository, notificationService);
		when(orderRepository.findByIdForUpdate(ORDER_ID)).thenReturn(Optional.of(order));
		when(order.getId()).thenReturn(ORDER_ID);
		when(order.getCustomerId()).thenReturn(CUSTOMER_ID);
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
		when(payment.getStatus()).thenReturn(PaymentStatus.PAID);

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
	void cancelsAtDeadlineForDraftAndKeepsPaidDepositWithoutRefund() {
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
		assertThat(payment.getStatus()).isEqualTo(PaymentStatus.PAID);
		verify(notificationService).createOrderCancelledForDocumentDeadline(CUSTOMER_ID, ORDER_ID);
	}

	@Test
	void doesNotCancelWhenAllSubmittedDocumentsArePendingReview() {
		when(versions.getFirst().getStatus()).thenReturn(DocumentVersionStatus.PENDING_REVIEW);

		assertThat(processor.cancelForIncompleteDeadline(ORDER_ID, DEADLINE)).isFalse();

		verify(orderRepository, never()).saveAndFlush(any());
		verify(auditRepository, never()).saveAndFlush(any());
		verify(notificationService, never()).createOrderCancelledForDocumentDeadline(any(), any());
	}

	@Test
	void opensFirstCorrectionWindowAtOriginalDeadlineWhenCurrentDocumentIsRejected() {
		when(versions.getFirst().getStatus()).thenReturn(DocumentVersionStatus.REJECTED);

		assertThat(processor.cancelForIncompleteDeadline(ORDER_ID, DEADLINE)).isFalse();

		verify(documents.getFirst()).openCorrectionWindow(1, DEADLINE.plusHours(24));
		verify(documentRepository).saveAll(anyCollection());
		verify(orderRepository, never()).saveAndFlush(any());
		verify(notificationService, never()).createOrderCancelledForDocumentDeadline(any(), any());
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
		verify(notificationService, never()).createOrderCancelledForDocumentDeadline(any(), any());
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
	void rejectionAfterOriginalDeadlineKeepsOrderActiveDuringCorrectionWindow() {
		LocalDateTime correctionDeadline = DEADLINE.plusHours(24);
		when(versions.getFirst().getStatus()).thenReturn(DocumentVersionStatus.REJECTED);
		when(documents.getFirst().getCorrectionWindowNo()).thenReturn(1);
		when(documents.getFirst().getCorrectionDeadlineAt()).thenReturn(correctionDeadline);

		assertThat(processor.cancelForIncompleteDeadline(ORDER_ID, DEADLINE.plusHours(1))).isFalse();

		verify(orderRepository, never()).saveAndFlush(any());
		verify(notificationService, never()).createOrderCancelledForDocumentDeadline(any(), any());
		verify(notificationService, never()).createOrderCancelledForCorrectionDeadline(any(), any());
	}

	@Test
	void missedCorrectionDeadlineCancelsWithoutRefundingPaidDeposit() {
		LocalDateTime correctionDeadline = DEADLINE.plusHours(24);
		when(versions.getFirst().getStatus()).thenReturn(DocumentVersionStatus.DRAFT);
		when(documents.getFirst().getCorrectionWindowNo()).thenReturn(1);
		when(documents.getFirst().getCorrectionDeadlineAt()).thenReturn(correctionDeadline);

		assertThat(processor.cancelForIncompleteDeadline(ORDER_ID, correctionDeadline)).isTrue();

		verify(order).cancelForDocumentDeadline(correctionDeadline);
		verify(auditRepository).saveAndFlush(any(StatusAuditLog.class));
		assertThat(payment.getStatus()).isEqualTo(PaymentStatus.PAID);
		verify(notificationService).createOrderCancelledForCorrectionDeadline(CUSTOMER_ID, ORDER_ID);
		verify(notificationService, never()).createOrderCancelledForDocumentDeadline(any(), any());
	}

	@Test
	void resubmittedPendingVersionDoesNotCancelAtCorrectionDeadline() {
		LocalDateTime correctionDeadline = DEADLINE.plusHours(24);
		when(versions.getFirst().getStatus()).thenReturn(DocumentVersionStatus.PENDING_REVIEW);
		when(documents.getFirst().getCorrectionWindowNo()).thenReturn(1);
		when(documents.getFirst().getCorrectionDeadlineAt()).thenReturn(correctionDeadline);

		assertThat(processor.cancelForIncompleteDeadline(ORDER_ID, correctionDeadline)).isFalse();

		verify(orderRepository, never()).saveAndFlush(any());
		verify(notificationService, never()).createOrderCancelledForCorrectionDeadline(any(), any());
	}

	@Test
	void missedSecondCorrectionWindowCancelsWithoutOpeningThirdWindow() {
		LocalDateTime correctionDeadline = DEADLINE.plusHours(48);
		when(versions.getFirst().getStatus()).thenReturn(DocumentVersionStatus.REJECTED);
		when(documents.getFirst().getCorrectionWindowNo()).thenReturn(2);
		when(documents.getFirst().getCorrectionDeadlineAt()).thenReturn(correctionDeadline);

		assertThat(processor.cancelForIncompleteDeadline(ORDER_ID, correctionDeadline)).isTrue();

		verify(documents.getFirst(), never()).openCorrectionWindow(anyInt(), any(LocalDateTime.class));
		verify(order).cancelForDocumentDeadline(correctionDeadline);
		verify(notificationService).createOrderCancelledForCorrectionDeadline(CUSTOMER_ID, ORDER_ID);
	}

	@Test
	void finalProtectedSubmissionRejectionCancelsWithUserAuditAndKeepsDepositPaid() {
		UUID actorId = UUID.fromString("44444444-4444-4444-4444-444444444444");
		LocalDateTime rejectedAt = DEADLINE.plusHours(49);

		processor.cancelAfterFinalCorrectionRejection(ORDER_ID, rejectedAt, actorId);

		verify(order).cancelAfterFinalDocumentCorrection(rejectedAt);
		ArgumentCaptor<StatusAuditLog> audit = ArgumentCaptor.forClass(StatusAuditLog.class);
		verify(auditRepository).saveAndFlush(audit.capture());
		assertThat(audit.getValue().getActorUserId()).isEqualTo(actorId);
		assertThat(audit.getValue().getReason()).isEqualTo("Final document correction window exhausted");
		assertThat(payment.getStatus()).isEqualTo(PaymentStatus.PAID);
		verify(notificationService).createOrderCancelledForCorrectionDeadline(CUSTOMER_ID, ORDER_ID);
	}

	@Test
	void retryDoesNotRepeatCancellationAuditOrNotificationAfterOrderIsCancelled() {
		when(versions.getFirst().getStatus()).thenReturn(DocumentVersionStatus.DRAFT);
		when(order.getStatus()).thenReturn(OrderStatus.APPROVED, OrderStatus.APPROVED, OrderStatus.CANCELLED);
		assertThat(processor.cancelForIncompleteDeadline(ORDER_ID, DEADLINE)).isTrue();
		assertThat(processor.cancelForIncompleteDeadline(ORDER_ID, DEADLINE)).isFalse();
		verify(auditRepository, times(1)).saveAndFlush(any(StatusAuditLog.class));
		verify(notificationService, times(1)).createOrderCancelledForDocumentDeadline(CUSTOMER_ID, ORDER_ID);
	}
}
