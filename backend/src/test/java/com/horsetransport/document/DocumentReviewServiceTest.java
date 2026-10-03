package com.horsetransport.document;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.horsetransport.audit.AuditActorKind;
import com.horsetransport.audit.AuditEntityType;
import com.horsetransport.audit.StatusAuditLog;
import com.horsetransport.audit.StatusAuditLogRepository;
import com.horsetransport.order.OrderHorseDocumentStatus;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderHorse;
import com.horsetransport.security.CurrentUserProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DocumentReviewServiceTest {

	private static final UUID TS_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final UUID DOCUMENT_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
	private static final UUID ORDER_HORSE_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
	private static final UUID OTHER_DOCUMENT_ID = UUID.fromString("44444444-4444-4444-4444-444444444444");

	@Mock private HorseDocumentRepository documentRepository;
	@Mock private HorseDocumentVersionRepository versionRepository;
	@Mock private StatusAuditLogRepository auditRepository;
	@Mock private CurrentUserProvider currentUserProvider;
	@Mock private HorseDocument document;
	@Mock private TransportOrderHorse orderHorse;
	@Mock private TransportOrder order;

	private DocumentReviewService service;

	@BeforeEach
	void setUp() {
		service = new DocumentReviewService(documentRepository, versionRepository, auditRepository,
				currentUserProvider);
		when(currentUserProvider.getCurrentUserId()).thenReturn(TS_ID);
		when(documentRepository.findByIdForUpdate(DOCUMENT_ID)).thenReturn(Optional.of(document));
		when(document.getId()).thenReturn(DOCUMENT_ID);
		when(document.getDocumentType()).thenReturn(DocumentType.HORSE_PASSPORT_OR_IDENTIFICATION);
		when(document.getTransportOrderHorse()).thenReturn(orderHorse);
		when(orderHorse.getId()).thenReturn(ORDER_HORSE_ID);
		when(orderHorse.getTransportOrder()).thenReturn(order);
		when(orderHorse.getDocumentStatus()).thenReturn(OrderHorseDocumentStatus.UNDER_REVIEW);
		when(order.getStatus()).thenReturn(OrderStatus.APPROVED);
		when(versionRepository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
	}

	@Test
	void approvesCurrentPendingVersionAndAuditsActor() {
		HorseDocumentVersion pending = pending(document);
		List<HorseDocumentVersion> current = List.of(pending, pending(document), pending(document),
				pending(document), pending(document));
		when(versionRepository.findCurrentByOrderHorseId(ORDER_HORSE_ID)).thenReturn(current);

		DocumentVersionResponse response = service.approve(DOCUMENT_ID, pending.getId());

		assertThat(response.status()).isEqualTo(DocumentVersionStatus.APPROVED);
		assertThat(pending.getReviewedBy()).isEqualTo(TS_ID);
		assertThat(pending.getReviewedAt()).isNotNull();
		assertThat(pending.getRejectionReason()).isNull();
		ArgumentCaptor<StatusAuditLog> audit = ArgumentCaptor.forClass(StatusAuditLog.class);
		verify(auditRepository).saveAndFlush(audit.capture());
		StatusAuditLog versionAudit = audit.getValue();
		assertThat(versionAudit.getEntityType()).isEqualTo(AuditEntityType.HORSE_DOCUMENT_VERSION);
		assertThat(versionAudit.getEntityId()).isEqualTo(pending.getId());
		assertThat(versionAudit.getOldStatus()).isEqualTo("PENDING_REVIEW");
		assertThat(versionAudit.getNewStatus()).isEqualTo("APPROVED");
		assertThat(versionAudit.getActorKind()).isEqualTo(AuditActorKind.USER);
		assertThat(versionAudit.getActorUserId()).isEqualTo(TS_ID);
		assertThat(versionAudit.getReason()).isNull();
		assertThat(versionAudit.getOccurredAt()).isNotNull();
	}

	@Test
	void rejectsPendingVersionWithTrimmedReasonAndMovesHorseToNeedsRevision() {
		HorseDocumentVersion pending = pending(document);
		when(versionRepository.findCurrentByOrderHorseId(ORDER_HORSE_ID)).thenReturn(List.of(pending));

		DocumentVersionResponse response = service.reject(DOCUMENT_ID, pending.getId(),
				new RejectDocumentVersionRequest("  Expired certificate  "));

		assertThat(response.status()).isEqualTo(DocumentVersionStatus.REJECTED);
		assertThat(response.rejectionReason()).isEqualTo("Expired certificate");
		assertThat(pending.getReviewedBy()).isEqualTo(TS_ID);
		verify(orderHorse).markDocumentsNeedingRevision();
		ArgumentCaptor<StatusAuditLog> audits = ArgumentCaptor.forClass(StatusAuditLog.class);
		verify(auditRepository, org.mockito.Mockito.times(2)).saveAndFlush(audits.capture());
		assertThat(audits.getAllValues()).anySatisfy(audit -> {
			assertThat(audit.getEntityType()).isEqualTo(AuditEntityType.HORSE_DOCUMENT_VERSION);
			assertThat(audit.getEntityId()).isEqualTo(pending.getId());
			assertThat(audit.getOldStatus()).isEqualTo("PENDING_REVIEW");
			assertThat(audit.getNewStatus()).isEqualTo("REJECTED");
			assertThat(audit.getActorKind()).isEqualTo(AuditActorKind.USER);
			assertThat(audit.getActorUserId()).isEqualTo(TS_ID);
			assertThat(audit.getReason()).isEqualTo("Expired certificate");
			assertThat(audit.getOccurredAt()).isNotNull();
		});
		assertThat(audits.getAllValues()).anySatisfy(audit -> {
			assertThat(audit.getEntityType()).isEqualTo(AuditEntityType.TRANSPORT_ORDER_HORSE);
			assertThat(audit.getEntityId()).isEqualTo(ORDER_HORSE_ID);
			assertThat(audit.getOldStatus()).isEqualTo("UNDER_REVIEW");
			assertThat(audit.getNewStatus()).isEqualTo("NEEDS_REVISION");
			assertThat(audit.getActorKind()).isEqualTo(AuditActorKind.USER);
			assertThat(audit.getActorUserId()).isEqualTo(TS_ID);
			assertThat(audit.getReason()).isNull();
			assertThat(audit.getOccurredAt()).isNotNull();
		});
	}

	@Test
	void rejectsBlankReasonAtServiceBoundary() {
		HorseDocumentVersion pending = pending(document);

		assertThatThrownBy(() -> service.reject(DOCUMENT_ID, pending.getId(),
				new RejectDocumentVersionRequest("   ")))
				.isInstanceOf(DocumentReviewValidationException.class);
		assertThat(pending.getStatus()).isEqualTo(DocumentVersionStatus.PENDING_REVIEW);
	}

	@Test
	void rejectsInvalidAndNonCurrentLifecycleStates() {
		for (DocumentVersionStatus status : List.of(DocumentVersionStatus.DRAFT,
				DocumentVersionStatus.REJECTED, DocumentVersionStatus.APPROVED)) {
			HorseDocumentVersion version = version(document, status, true);
			assertThatThrownBy(() -> service.approve(DOCUMENT_ID, version.getId()))
					.isInstanceOf(DocumentVersionConflictException.class);
		}
		HorseDocumentVersion historicalPending = version(document, DocumentVersionStatus.PENDING_REVIEW, false);
		assertThatThrownBy(() -> service.reject(DOCUMENT_ID, historicalPending.getId(),
				new RejectDocumentVersionRequest("reason")))
				.isInstanceOf(DocumentVersionConflictException.class);
	}

	@Test
	void mismatchedDocumentAndVersionIsNotFound() {
		HorseDocument otherDocument = org.mockito.Mockito.mock(HorseDocument.class);
		when(otherDocument.getId()).thenReturn(OTHER_DOCUMENT_ID);
		HorseDocumentVersion version = pending(otherDocument);

		assertThatThrownBy(() -> service.approve(DOCUMENT_ID, version.getId()))
				.isInstanceOf(DocumentVersionNotFoundException.class);
	}

	@Test
	void duplicateReviewRequestFailsAfterFirstDecision() {
		HorseDocumentVersion pending = pending(document);
		when(versionRepository.findCurrentByOrderHorseId(ORDER_HORSE_ID)).thenReturn(List.of(pending));

		service.approve(DOCUMENT_ID, pending.getId());

		assertThatThrownBy(() -> service.approve(DOCUMENT_ID, pending.getId()))
				.isInstanceOf(DocumentVersionConflictException.class);
	}

	@Test
	void auditFailureRestoresPendingVersionAndHorseStatus() {
		HorseDocumentVersion pending = pending(document);
		when(versionRepository.findCurrentByOrderHorseId(ORDER_HORSE_ID)).thenReturn(List.of(pending));
		when(auditRepository.saveAndFlush(any())).thenThrow(new IllegalStateException("audit failed"));

		assertThatThrownBy(() -> service.reject(DOCUMENT_ID, pending.getId(),
				new RejectDocumentVersionRequest("invalid")))
				.isInstanceOf(IllegalStateException.class).hasMessage("audit failed");
		assertThat(pending.getStatus()).isEqualTo(DocumentVersionStatus.PENDING_REVIEW);
		assertThat(pending.getReviewedBy()).isNull();
		assertThat(pending.getReviewedAt()).isNull();
		assertThat(pending.getRejectionReason()).isNull();
		verify(orderHorse).restoreDocumentStatus(OrderHorseDocumentStatus.UNDER_REVIEW);
	}

	@Test
	void horseAuditFailureRollsBackVersionAndHorseTransition() {
		HorseDocumentVersion pending = pending(document);
		when(versionRepository.findCurrentByOrderHorseId(ORDER_HORSE_ID)).thenReturn(List.of(pending));
		when(auditRepository.saveAndFlush(any()))
				.thenAnswer(invocation -> invocation.getArgument(0))
				.thenThrow(new IllegalStateException("horse audit failed"));

		assertThatThrownBy(() -> service.reject(DOCUMENT_ID, pending.getId(),
				new RejectDocumentVersionRequest("invalid")))
				.isInstanceOf(IllegalStateException.class).hasMessage("horse audit failed");
		assertThat(pending.getStatus()).isEqualTo(DocumentVersionStatus.PENDING_REVIEW);
		assertThat(pending.getReviewedBy()).isNull();
		assertThat(pending.getRejectionReason()).isNull();
		verify(orderHorse).markDocumentsNeedingRevision();
		verify(orderHorse).restoreDocumentStatus(OrderHorseDocumentStatus.UNDER_REVIEW);
	}

	@Test
	void fifthApprovalMakesHorseEligibleAndAuditsTransition() {
		HorseDocumentVersion pending = pending(document);
		List<HorseDocumentVersion> current = new ArrayList<>();
		current.add(pending);
		for (int index = 0; index < DocumentType.values().length - 1; index++) {
			HorseDocumentVersion approved = pending(document);
			approved.approve(TS_ID);
			current.add(approved);
		}
		when(versionRepository.findCurrentByOrderHorseId(ORDER_HORSE_ID)).thenReturn(current);

		service.approve(DOCUMENT_ID, pending.getId());

		verify(orderHorse).markDocumentsEligibleForExport();
		ArgumentCaptor<StatusAuditLog> audits = ArgumentCaptor.forClass(StatusAuditLog.class);
		verify(auditRepository, org.mockito.Mockito.times(2)).saveAndFlush(audits.capture());
		assertThat(audits.getAllValues()).anySatisfy(audit -> {
			assertThat(audit.getEntityType()).isEqualTo(AuditEntityType.TRANSPORT_ORDER_HORSE);
			assertThat(audit.getNewStatus()).isEqualTo("ELIGIBLE_FOR_EXPORT");
		});
	}

	@Test
	void partialApprovalKeepsHorseUnderReviewWithoutDuplicateHorseAudit() {
		HorseDocumentVersion pending = pending(document);
		List<HorseDocumentVersion> current = new ArrayList<>();
		current.add(pending);
		for (int index = 0; index < DocumentType.values().length - 1; index++) {
			current.add(pending(document));
		}
		when(versionRepository.findCurrentByOrderHorseId(ORDER_HORSE_ID)).thenReturn(current);

		service.approve(DOCUMENT_ID, pending.getId());

		verify(orderHorse, never()).markDocumentsEligibleForExport();
		verify(orderHorse, never()).markDocumentsUnderReview();
		verify(auditRepository).saveAndFlush(any(StatusAuditLog.class));
	}

	@Test
	void pastDeadlineDoesNotAutoDecideOrCancelOrder() {
		when(order.getDocumentCompletionDeadlineAt()).thenReturn(LocalDateTime.of(2020, 1, 1, 0, 0));
		HorseDocumentVersion pending = pending(document);
		when(versionRepository.findCurrentByOrderHorseId(ORDER_HORSE_ID)).thenReturn(List.of(pending));

		service.reject(DOCUMENT_ID, pending.getId(), new RejectDocumentVersionRequest("manual decision"));

		assertThat(pending.getStatus()).isEqualTo(DocumentVersionStatus.REJECTED);
		assertThat(order.getStatus()).isEqualTo(OrderStatus.APPROVED);
	}

	private HorseDocumentVersion pending(HorseDocument parent) {
		return version(parent, DocumentVersionStatus.PENDING_REVIEW, true);
	}

	private HorseDocumentVersion version(HorseDocument parent, DocumentVersionStatus status,
			boolean current) {
		HorseDocumentVersion version = new HorseDocumentVersion(parent, 1, "https://example.test/document.pdf",
				null, UUID.randomUUID());
		ReflectionTestUtils.setField(version, "status", status);
		ReflectionTestUtils.setField(version, "current", current);
		when(versionRepository.findById(version.getId())).thenReturn(Optional.of(version));
		return version;
	}
}
