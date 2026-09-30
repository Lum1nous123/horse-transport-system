package com.horsetransport.document;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DocumentVersionServiceTest {

	private static final UUID CUSTOMER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final UUID ORDER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
	private static final UUID ORDER_HORSE_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
	private static final UUID DOCUMENT_ID = UUID.fromString("44444444-4444-4444-4444-444444444444");
	private static final String PUBLIC_ID = "horse-transport/orders/" + ORDER_ID + "/documents/" + DOCUMENT_ID + "/v1";
	private static final String URL = "https://res.cloudinary.com/test/image/upload/document.pdf";

	@Mock private HorseDocumentRepository documentRepository;
	@Mock private HorseDocumentVersionRepository versionRepository;
	@Mock private StatusAuditLogRepository auditRepository;
	@Mock private CurrentUserProvider currentUserProvider;
	@Mock private DocumentStorage storage;
	@Mock private HorseDocument document;
	@Mock private TransportOrderHorse orderHorse;
	@Mock private TransportOrder order;

	private DocumentVersionService service;

	@BeforeEach
	void setUp() {
		service = new DocumentVersionService(documentRepository, versionRepository, auditRepository,
				currentUserProvider, storage);
		when(currentUserProvider.getCurrentUserId()).thenReturn(CUSTOMER_ID);
		when(documentRepository.findOwnedByIdForUpdate(DOCUMENT_ID, CUSTOMER_ID))
				.thenReturn(Optional.of(document));
		when(document.getId()).thenReturn(DOCUMENT_ID);
		when(document.getTransportOrderHorseId()).thenReturn(ORDER_HORSE_ID);
		when(document.getTransportOrderHorse()).thenReturn(orderHorse);
		when(orderHorse.getId()).thenReturn(ORDER_HORSE_ID);
		when(orderHorse.getTransportOrder()).thenReturn(order);
		when(orderHorse.getDocumentStatus()).thenReturn(OrderHorseDocumentStatus.INCOMPLETE);
		when(order.getId()).thenReturn(ORDER_ID);
		when(order.getStatus()).thenReturn(OrderStatus.APPROVED);
		when(storage.upload(any(), any(), any(), any(Boolean.class))).thenReturn(URL);
		when(versionRepository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
	}

	@Test
	void createsFirstDraftWithoutCreatingChecklistParent() {
		when(versionRepository.findByHorseDocumentIdAndCurrentTrue(DOCUMENT_ID)).thenReturn(Optional.empty());
		when(versionRepository.findMaximumVersionNo(DOCUMENT_ID)).thenReturn(0);

		DocumentVersionResponse response = service.create(DOCUMENT_ID, pdf(), LocalDate.of(2027, 1, 1));

		assertThat(response.versionNo()).isEqualTo(1);
		assertThat(response.status()).isEqualTo(DocumentVersionStatus.DRAFT);
		assertThat(response.isCurrent()).isTrue();
		assertThat(response.expiryDate()).isEqualTo(LocalDate.of(2027, 1, 1));
		verify(storage).upload(any(), eq("application/pdf"), eq(PUBLIC_ID), eq(false));
		verify(documentRepository, never()).save(any());
	}

	@Test
	void rejectsNonOwnerBeforeStorageUpload() {
		when(documentRepository.findOwnedByIdForUpdate(DOCUMENT_ID, CUSTOMER_ID)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.create(DOCUMENT_ID, pdf(), null))
				.isInstanceOf(HorseDocumentNotFoundException.class);
		verify(storage, never()).upload(any(), any(), any(), any(Boolean.class));
	}

	@Test
	void replacesCurrentDraftWithoutChangingIdentityOrVersionNumber() {
		HorseDocumentVersion draft = draft(1);

		DocumentVersionResponse response = service.replace(DOCUMENT_ID, draft.getId(), png(), null);

		assertThat(response.id()).isEqualTo(draft.getId());
		assertThat(response.versionNo()).isEqualTo(1);
		assertThat(response.status()).isEqualTo(DocumentVersionStatus.DRAFT);
		assertThat(response.expiryDate()).isNull();
		ArgumentCaptor<String> replacementId = ArgumentCaptor.forClass(String.class);
		verify(storage).upload(any(), eq("image/png"), replacementId.capture(), eq(false));
		assertThat(replacementId.getValue()).startsWith(PUBLIC_ID + "-replacement-");
		verify(storage).deleteByUrl(URL);
	}

	@Test
	void deletesOnlyDraftVersionBeforeCleaningObject() {
		HorseDocumentVersion draft = draft(1);

		service.deleteDraft(DOCUMENT_ID, draft.getId());

		verify(versionRepository).delete(draft);
		verify(storage).deleteByUrl(URL);
		verify(documentRepository, never()).delete(any());
	}

	@Test
	void deletedUnsubmittedDraftAllowsVersionOneReuse() {
		when(versionRepository.findByHorseDocumentIdAndCurrentTrue(DOCUMENT_ID)).thenReturn(Optional.empty());
		when(versionRepository.findMaximumVersionNo(DOCUMENT_ID)).thenReturn(0);

		assertThat(service.create(DOCUMENT_ID, pdf(), null).versionNo()).isEqualTo(1);
	}

	@Test
	void submitTransitionsAndAuditsVersion() {
		HorseDocumentVersion draft = draft(1);
		when(versionRepository.findCurrentByOrderHorseId(ORDER_HORSE_ID)).thenReturn(List.of(draft));

		DocumentVersionResponse response = service.submit(DOCUMENT_ID, draft.getId());

		assertThat(response.status()).isEqualTo(DocumentVersionStatus.PENDING_REVIEW);
		assertThat(response.submittedAt()).isNotNull();
		ArgumentCaptor<StatusAuditLog> audit = ArgumentCaptor.forClass(StatusAuditLog.class);
		verify(auditRepository).saveAndFlush(audit.capture());
		assertThat(audit.getValue().getEntityType()).isEqualTo(AuditEntityType.HORSE_DOCUMENT_VERSION);
		assertThat(audit.getValue().getEntityId()).isEqualTo(draft.getId());
		assertThat(audit.getValue().getOldStatus()).isEqualTo("DRAFT");
		assertThat(audit.getValue().getNewStatus()).isEqualTo("PENDING_REVIEW");
		assertThat(audit.getValue().getActorUserId()).isEqualTo(CUSTOMER_ID);
		verify(orderHorse, never()).markDocumentsUnderReview();
	}

	@Test
	void duplicateSubmitAndSubmittedMutationsAreConflicts() {
		for (DocumentVersionStatus status : List.of(DocumentVersionStatus.PENDING_REVIEW,
				DocumentVersionStatus.APPROVED, DocumentVersionStatus.REJECTED)) {
			HorseDocumentVersion submitted = draft(1);
			ReflectionTestUtils.setField(submitted, "status", status);
			assertThatThrownBy(() -> service.submit(DOCUMENT_ID, submitted.getId()))
					.isInstanceOf(DocumentVersionConflictException.class);
			assertThatThrownBy(() -> service.replace(DOCUMENT_ID, submitted.getId(), pdf(), null))
					.isInstanceOf(DocumentVersionConflictException.class);
			assertThatThrownBy(() -> service.deleteDraft(DOCUMENT_ID, submitted.getId()))
					.isInstanceOf(DocumentVersionConflictException.class);
		}
	}

	@Test
	void auditFailureAbortsSubmitFlow() {
		HorseDocumentVersion draft = draft(1);
		when(auditRepository.saveAndFlush(any())).thenThrow(new IllegalStateException("audit failed"));

		assertThatThrownBy(() -> service.submit(DOCUMENT_ID, draft.getId()))
				.isInstanceOf(IllegalStateException.class).hasMessage("audit failed");
		assertThat(draft.getStatus()).isEqualTo(DocumentVersionStatus.DRAFT);
		assertThat(draft.getSubmittedAt()).isNull();
	}

	@Test
	void rejectedCurrentCreatesNextDraftAndPreservesReviewHistory() {
		HorseDocumentVersion rejected = draft(1);
		ReflectionTestUtils.setField(rejected, "status", DocumentVersionStatus.REJECTED);
		ReflectionTestUtils.setField(rejected, "reviewedAt", LocalDateTime.of(2026, 10, 1, 12, 0));
		ReflectionTestUtils.setField(rejected, "rejectionReason", "Invalid certificate");
		when(versionRepository.findByHorseDocumentIdAndCurrentTrue(DOCUMENT_ID)).thenReturn(Optional.of(rejected));
		when(versionRepository.findMaximumVersionNo(DOCUMENT_ID)).thenReturn(1);
		when(storage.upload(any(), any(), any(), eq(false))).thenReturn(URL);

		DocumentVersionResponse created = service.create(DOCUMENT_ID, pdf(), null);

		assertThat(rejected.isCurrent()).isFalse();
		assertThat(rejected.getStatus()).isEqualTo(DocumentVersionStatus.REJECTED);
		assertThat(rejected.getRejectionReason()).isEqualTo("Invalid certificate");
		assertThat(created.versionNo()).isEqualTo(2);
		assertThat(created.status()).isEqualTo(DocumentVersionStatus.DRAFT);
		assertThat(created.submittedAt()).isNull();
		assertThat(created.reviewedAt()).isNull();
		assertThat(created.rejectionReason()).isNull();
	}

	@Test
	void newDraftAfterRejectionMovesHorseBackToIncompleteWithAudit() {
		HorseDocumentVersion rejected = draft(1);
		ReflectionTestUtils.setField(rejected, "status", DocumentVersionStatus.REJECTED);
		when(orderHorse.getDocumentStatus()).thenReturn(OrderHorseDocumentStatus.NEEDS_REVISION);
		when(versionRepository.findByHorseDocumentIdAndCurrentTrue(DOCUMENT_ID)).thenReturn(Optional.of(rejected));
		when(versionRepository.findMaximumVersionNo(DOCUMENT_ID)).thenReturn(1);

		service.create(DOCUMENT_ID, pdf(), null);

		verify(orderHorse).markDocumentsIncomplete();
		ArgumentCaptor<StatusAuditLog> audit = ArgumentCaptor.forClass(StatusAuditLog.class);
		verify(auditRepository).saveAndFlush(audit.capture());
		assertThat(audit.getValue().getEntityType()).isEqualTo(AuditEntityType.TRANSPORT_ORDER_HORSE);
		assertThat(audit.getValue().getOldStatus()).isEqualTo("NEEDS_REVISION");
		assertThat(audit.getValue().getNewStatus()).isEqualTo("INCOMPLETE");
	}

	@Test
	void pendingOrApprovedCurrentBlocksNewVersion() {
		for (DocumentVersionStatus status : List.of(DocumentVersionStatus.PENDING_REVIEW,
				DocumentVersionStatus.APPROVED)) {
			HorseDocumentVersion current = draft(1);
			ReflectionTestUtils.setField(current, "status", status);
			when(versionRepository.findByHorseDocumentIdAndCurrentTrue(DOCUMENT_ID))
					.thenReturn(Optional.of(current));
			assertThatThrownBy(() -> service.create(DOCUMENT_ID, pdf(), null))
					.isInstanceOf(DocumentVersionConflictException.class);
		}
	}

	@Test
	void returnsHistoryInRepositoryNewestFirstOrder() {
		when(documentRepository.findOwnedById(DOCUMENT_ID, CUSTOMER_ID)).thenReturn(Optional.of(document));
		HorseDocumentVersion first = draft(1);
		HorseDocumentVersion second = draft(2);
		when(versionRepository.findAllByHorseDocumentIdOrderByVersionNoDesc(DOCUMENT_ID))
				.thenReturn(List.of(second, first));

		assertThat(service.history(DOCUMENT_ID)).extracting(DocumentVersionResponse::versionNo)
				.containsExactly(2, 1);
	}

	@Test
	void validatesMimeAndTenMegabyteLimitBeforeStorage() {
		MockMultipartFile invalid = new MockMultipartFile("file", "doc.txt", "text/plain", new byte[] {1});
		MockMultipartFile oversized = new MockMultipartFile("file", "doc.pdf", "application/pdf",
				new byte[10 * 1024 * 1024 + 1]);

		assertThatThrownBy(() -> service.create(DOCUMENT_ID, invalid, null))
				.isInstanceOf(DocumentFileValidationException.class);
		assertThatThrownBy(() -> service.create(DOCUMENT_ID, oversized, null))
				.isInstanceOf(DocumentFileValidationException.class);
		verify(storage, never()).upload(any(), any(), any(), any(Boolean.class));
	}

	@Test
	void storageFailureDoesNotWriteVersion() {
		when(versionRepository.findByHorseDocumentIdAndCurrentTrue(DOCUMENT_ID)).thenReturn(Optional.empty());
		when(versionRepository.findMaximumVersionNo(DOCUMENT_ID)).thenReturn(0);
		when(storage.upload(any(), any(), any(), eq(false))).thenThrow(new DocumentStorageException("failed"));

		assertThatThrownBy(() -> service.create(DOCUMENT_ID, pdf(), null))
				.isInstanceOf(DocumentStorageException.class);
		verify(versionRepository, never()).saveAndFlush(any());
	}

	@Test
	void cleanupFailureAfterCommitDoesNotFailCompletedDatabaseDelete() {
		HorseDocumentVersion draft = draft(1);
		doThrow(new DocumentStorageException("delete failed")).when(storage).deleteByUrl(URL);
		TransactionSynchronizationManager.initSynchronization();
		try {
			service.deleteDraft(DOCUMENT_ID, draft.getId());
			List<TransactionSynchronization> callbacks = TransactionSynchronizationManager.getSynchronizations();

			callbacks.forEach(TransactionSynchronization::afterCommit);

			verify(versionRepository).delete(draft);
			verify(versionRepository).flush();
		}
		finally {
			TransactionSynchronizationManager.clearSynchronization();
		}
	}

	@Test
	void failedReplaceCleansNewObjectAndKeepsOldObjectAndMetadata() {
		HorseDocumentVersion draft = draft(1);
		LocalDate originalExpiry = LocalDate.of(2027, 1, 1);
		ReflectionTestUtils.setField(draft, "expiryDate", originalExpiry);
		when(versionRepository.saveAndFlush(draft)).thenThrow(new IllegalStateException("database failed"));
		TransactionSynchronizationManager.initSynchronization();
		try {
			assertThatThrownBy(() -> service.replace(DOCUMENT_ID, draft.getId(), png(), null))
					.isInstanceOf(IllegalStateException.class).hasMessage("database failed");
			List<TransactionSynchronization> callbacks = TransactionSynchronizationManager.getSynchronizations();
			callbacks.forEach(callback -> callback.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));

			ArgumentCaptor<String> replacementId = ArgumentCaptor.forClass(String.class);
			verify(storage).upload(any(), eq("image/png"), replacementId.capture(), eq(false));
			verify(storage).delete(replacementId.getValue());
			verify(storage, never()).deleteByUrl(URL);
			assertThat(draft.getFileUrl()).isEqualTo(URL);
			assertThat(draft.getExpiryDate()).isEqualTo(originalExpiry);
		}
		finally {
			TransactionSynchronizationManager.clearSynchronization();
		}
	}

	@Test
	void successfulReplaceDeletesOldObjectOnlyAfterCommit() {
		HorseDocumentVersion draft = draft(1);
		TransactionSynchronizationManager.initSynchronization();
		try {
			service.replace(DOCUMENT_ID, draft.getId(), png(), null);
			verify(storage, never()).deleteByUrl(URL);
			verify(storage, never()).delete(any(String.class));

			List<TransactionSynchronization> callbacks = TransactionSynchronizationManager.getSynchronizations();
			callbacks.forEach(TransactionSynchronization::afterCommit);
			callbacks.forEach(callback -> callback.afterCompletion(TransactionSynchronization.STATUS_COMMITTED));

			verify(storage).deleteByUrl(URL);
			verify(storage, never()).delete(any(String.class));
		}
		finally {
			TransactionSynchronizationManager.clearSynchronization();
		}
	}

	@Test
	void failedDatabaseDeleteNeverDeletesCloudObject() {
		HorseDocumentVersion draft = draft(1);
		doThrow(new IllegalStateException("database failed")).when(versionRepository).flush();

		assertThatThrownBy(() -> service.deleteDraft(DOCUMENT_ID, draft.getId()))
				.isInstanceOf(IllegalStateException.class).hasMessage("database failed");
		verify(versionRepository).delete(draft);
		verify(storage, never()).deleteByUrl(any());
		verify(storage, never()).delete(any());
	}

	@Test
	void successfulDeleteCleansCloudObjectOnlyAfterCommit() {
		HorseDocumentVersion draft = draft(1);
		TransactionSynchronizationManager.initSynchronization();
		try {
			service.deleteDraft(DOCUMENT_ID, draft.getId());
			verify(storage, never()).deleteByUrl(URL);

			List<TransactionSynchronization> callbacks = TransactionSynchronizationManager.getSynchronizations();
			callbacks.forEach(TransactionSynchronization::afterCommit);
			callbacks.forEach(callback -> callback.afterCompletion(TransactionSynchronization.STATUS_COMMITTED));
			verify(storage).deleteByUrl(URL);
		}
		finally {
			TransactionSynchronizationManager.clearSynchronization();
		}
	}

	@Test
	void rolledBackDeleteTransactionDoesNotDeleteCloudObject() {
		HorseDocumentVersion draft = draft(1);
		TransactionSynchronizationManager.initSynchronization();
		try {
			service.deleteDraft(DOCUMENT_ID, draft.getId());
			List<TransactionSynchronization> callbacks = TransactionSynchronizationManager.getSynchronizations();

			callbacks.forEach(callback -> callback.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));

			verify(storage, never()).deleteByUrl(any());
			verify(storage, never()).delete(any());
		}
		finally {
			TransactionSynchronizationManager.clearSynchronization();
		}
	}

	@Test
	void databaseFailureAfterUploadTriggersBestEffortCleanupOutsideManagedTransaction() {
		when(versionRepository.findByHorseDocumentIdAndCurrentTrue(DOCUMENT_ID)).thenReturn(Optional.empty());
		when(versionRepository.findMaximumVersionNo(DOCUMENT_ID)).thenReturn(0);
		when(versionRepository.saveAndFlush(any())).thenThrow(new IllegalStateException("database failed"));

		assertThatThrownBy(() -> service.create(DOCUMENT_ID, pdf(), null))
				.isInstanceOf(IllegalStateException.class);
		verify(storage).delete(PUBLIC_ID);
	}

	@Test
	void fifthPendingVersionMovesHorseUnderReviewAndAuditsHorseTransition() {
		HorseDocumentVersion draft = draft(1);
		List<HorseDocumentVersion> current = new ArrayList<>();
		current.add(draft);
		for (int index = 2; index <= 5; index++) {
			HorseDocumentVersion pending = draft(index);
			pending.submit();
			current.add(pending);
		}
		when(versionRepository.findCurrentByOrderHorseId(ORDER_HORSE_ID)).thenReturn(current);

		service.submit(DOCUMENT_ID, draft.getId());

		verify(orderHorse).markDocumentsUnderReview();
		ArgumentCaptor<StatusAuditLog> audits = ArgumentCaptor.forClass(StatusAuditLog.class);
		verify(auditRepository, org.mockito.Mockito.times(2)).saveAndFlush(audits.capture());
		assertThat(audits.getAllValues()).anySatisfy(audit -> {
			assertThat(audit.getEntityType()).isEqualTo(AuditEntityType.TRANSPORT_ORDER_HORSE);
			assertThat(audit.getOldStatus()).isEqualTo("INCOMPLETE");
			assertThat(audit.getNewStatus()).isEqualTo("UNDER_REVIEW");
		});
	}

	@Test
	void doesNotEnforcePastDeadlineButBlocksInactiveOrderState() {
		when(order.getDocumentCompletionDeadlineAt()).thenReturn(LocalDateTime.of(2020, 1, 1, 0, 0));
		when(versionRepository.findByHorseDocumentIdAndCurrentTrue(DOCUMENT_ID)).thenReturn(Optional.empty());
		when(versionRepository.findMaximumVersionNo(DOCUMENT_ID)).thenReturn(0);
		assertThat(service.create(DOCUMENT_ID, pdf(), null).status()).isEqualTo(DocumentVersionStatus.DRAFT);

		when(order.getStatus()).thenReturn(OrderStatus.CANCELLED);
		assertThatThrownBy(() -> service.create(DOCUMENT_ID, pdf(), null))
				.isInstanceOf(DocumentVersionConflictException.class);
	}

	private HorseDocumentVersion draft(int versionNo) {
		HorseDocumentVersion version = new HorseDocumentVersion(document, versionNo, URL, null, CUSTOMER_ID);
		when(versionRepository.findById(version.getId())).thenReturn(Optional.of(version));
		return version;
	}

	private MockMultipartFile pdf() {
		return new MockMultipartFile("file", "document.pdf", "application/pdf",
				new byte[] {0x25, 0x50, 0x44, 0x46, 0x2D, 0x31});
	}

	private MockMultipartFile png() {
		return new MockMultipartFile("file", "document.png", "image/png",
				new byte[] {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A});
	}
}
