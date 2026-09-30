package com.horsetransport.document;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.horsetransport.audit.AuditEntityType;
import com.horsetransport.audit.StatusAuditLog;
import com.horsetransport.audit.StatusAuditLogRepository;
import com.horsetransport.order.OrderHorseDocumentStatus;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderHorse;
import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserRole;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

@Service
public class DocumentVersionService {

	private static final Logger LOGGER = LoggerFactory.getLogger(DocumentVersionService.class);
	private static final long MAX_FILE_SIZE = 10L * 1024 * 1024;
	private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
			"application/pdf", "image/jpeg", "image/png");

	private final HorseDocumentRepository documentRepository;
	private final HorseDocumentVersionRepository versionRepository;
	private final StatusAuditLogRepository auditRepository;
	private final CurrentUserProvider currentUserProvider;
	private final DocumentStorage storage;

	public DocumentVersionService(HorseDocumentRepository documentRepository,
			HorseDocumentVersionRepository versionRepository, StatusAuditLogRepository auditRepository,
			CurrentUserProvider currentUserProvider, DocumentStorage storage) {
		this.documentRepository = documentRepository;
		this.versionRepository = versionRepository;
		this.auditRepository = auditRepository;
		this.currentUserProvider = currentUserProvider;
		this.storage = storage;
	}

	@Transactional
	public DocumentVersionResponse create(UUID documentId, MultipartFile file, LocalDate expiryDate) {
		ValidatedFile validatedFile = validate(file);
		UUID actorUserId = currentUserProvider.getCurrentUserId();
		HorseDocument document = findOwnedForUpdate(documentId, actorUserId);
		ensureActiveDocumentPhase(document);

		HorseDocumentVersion previous = versionRepository.findByHorseDocument_IdAndCurrentTrue(documentId)
				.orElse(null);
		if (previous != null && previous.getStatus() != DocumentVersionStatus.REJECTED) {
			throw new DocumentVersionConflictException("A current document version already exists");
		}

		int versionNo = versionRepository.findMaximumVersionNo(documentId) + 1;
		String publicId = publicId(document, versionNo);
		String fileUrl = storage.upload(validatedFile.content(), validatedFile.contentType(), publicId, false);
		boolean rollbackCleanupRegistered = registerDeleteOnRollback(publicId);
		OrderHorseDocumentStatus previousHorseStatus = document.getTransportOrderHorse().getDocumentStatus();

		try {
			ensureUrlFitsSchema(fileUrl);
			if (previous != null) {
				previous.makeHistorical();
				versionRepository.saveAndFlush(previous);
			}
			HorseDocumentVersion created = new HorseDocumentVersion(document, versionNo, fileUrl, expiryDate,
					actorUserId);
			created = versionRepository.saveAndFlush(created);
			updateHorseStatus(document.getTransportOrderHorse(), OrderHorseDocumentStatus.INCOMPLETE,
					actorUserId);
			return DocumentVersionResponse.from(created);
		}
		catch (RuntimeException exception) {
			if (previous != null) previous.restoreCurrentAfterCreationFailure();
			document.getTransportOrderHorse().restoreDocumentStatus(previousHorseStatus);
			if (!rollbackCleanupRegistered) bestEffortDelete(publicId);
			throw exception;
		}
	}

	@Transactional
	public DocumentVersionResponse replace(UUID documentId, UUID versionId, MultipartFile file,
			LocalDate expiryDate) {
		ValidatedFile validatedFile = validate(file);
		UUID actorUserId = currentUserProvider.getCurrentUserId();
		HorseDocument document = findOwnedForUpdate(documentId, actorUserId);
		ensureActiveDocumentPhase(document);
		HorseDocumentVersion version = findVersion(documentId, versionId);
		version.requireCurrentDraft("replaced");

		String previousUrl = version.getFileUrl();
		LocalDate previousExpiryDate = version.getExpiryDate();
		UUID previousUploadedBy = version.getUploadedBy();
		var previousUploadedAt = version.getUploadedAt();
		OrderHorseDocumentStatus previousHorseStatus = document.getTransportOrderHorse().getDocumentStatus();
		String replacementPublicId = replacementPublicId(document, version.getVersionNo());
		String fileUrl = storage.upload(validatedFile.content(), validatedFile.contentType(),
				replacementPublicId, false);
		boolean cleanupRegistered = registerReplacementCleanup(previousUrl, replacementPublicId);

		try {
			ensureUrlFitsSchema(fileUrl);
			version.replaceDraft(fileUrl, expiryDate, actorUserId);
			version = versionRepository.saveAndFlush(version);
			updateHorseStatus(document.getTransportOrderHorse(), OrderHorseDocumentStatus.INCOMPLETE,
					actorUserId);
			if (!cleanupRegistered) bestEffortDeleteByUrl(previousUrl, "after document replacement");
			return DocumentVersionResponse.from(version);
		}
		catch (RuntimeException exception) {
			version.restoreAfterReplaceFailure(previousUrl, previousExpiryDate, previousUploadedBy,
					previousUploadedAt);
			document.getTransportOrderHorse().restoreDocumentStatus(previousHorseStatus);
			if (!cleanupRegistered) bestEffortDelete(replacementPublicId);
			throw exception;
		}
	}

	@Transactional
	public void deleteDraft(UUID documentId, UUID versionId) {
		UUID actorUserId = currentUserProvider.getCurrentUserId();
		HorseDocument document = findOwnedForUpdate(documentId, actorUserId);
		ensureActiveDocumentPhase(document);
		HorseDocumentVersion version = findVersion(documentId, versionId);
		version.requireCurrentDraft("deleted");

		String fileUrl = version.getFileUrl();
		versionRepository.delete(version);
		versionRepository.flush();
		updateHorseStatus(document.getTransportOrderHorse(), OrderHorseDocumentStatus.INCOMPLETE,
				actorUserId);
		if (!registerDeleteAfterCommit(fileUrl)) {
			bestEffortDeleteByUrl(fileUrl, "after document deletion");
		}
	}

	@Transactional
	public DocumentVersionResponse submit(UUID documentId, UUID versionId) {
		UUID actorUserId = currentUserProvider.getCurrentUserId();
		HorseDocument document = findOwnedForUpdate(documentId, actorUserId);
		ensureActiveDocumentPhase(document);
		HorseDocumentVersion version = findVersion(documentId, versionId);
		OrderHorseDocumentStatus previousHorseStatus = document.getTransportOrderHorse().getDocumentStatus();
		version.submit();
		try {
			version = versionRepository.saveAndFlush(version);
			auditRepository.saveAndFlush(StatusAuditLog.userTransition(AuditEntityType.HORSE_DOCUMENT_VERSION,
					version.getId(), DocumentVersionStatus.DRAFT.name(),
					DocumentVersionStatus.PENDING_REVIEW.name(), actorUserId, null));

			List<HorseDocumentVersion> currentVersions = versionRepository.findCurrentByOrderHorseId(
					document.getTransportOrderHorseId());
			updateHorseStatus(document.getTransportOrderHorse(),
					HorseDocumentStatusResolver.resolve(currentVersions), actorUserId);
			return DocumentVersionResponse.from(version);
		}
		catch (RuntimeException exception) {
			version.restoreDraftAfterSubmitFailure();
			document.getTransportOrderHorse().restoreDocumentStatus(previousHorseStatus);
			throw exception;
		}
	}

	@Transactional(readOnly = true)
	public List<DocumentVersionResponse> history(UUID documentId) {
		UUID actorUserId = currentUserProvider.getCurrentUserId();
		boolean transportSpecialist = currentUserProvider.getCurrentUserRole() == UserRole.TRANSPORT_SPECIALIST;
		if (transportSpecialist) {
			HorseDocument document = documentRepository.findById(documentId)
					.orElseThrow(HorseDocumentNotFoundException::new);
			ensureActiveDocumentPhase(document);
		}
		else {
			documentRepository.findOwnedById(documentId, actorUserId)
					.orElseThrow(HorseDocumentNotFoundException::new);
		}
		return versionRepository.findAllByHorseDocument_IdOrderByVersionNoDesc(documentId).stream()
				.filter(version -> !transportSpecialist || version.getStatus() != DocumentVersionStatus.DRAFT)
				.map(DocumentVersionResponse::from)
				.toList();
	}

	private HorseDocument findOwnedForUpdate(UUID documentId, UUID actorUserId) {
		return documentRepository.findOwnedByIdForUpdate(documentId, actorUserId)
				.orElseThrow(HorseDocumentNotFoundException::new);
	}

	private HorseDocumentVersion findVersion(UUID documentId, UUID versionId) {
		return versionRepository.findById(versionId)
				.filter(version -> version.getHorseDocumentId().equals(documentId))
				.orElseThrow(DocumentVersionNotFoundException::new);
	}

	private void ensureActiveDocumentPhase(HorseDocument document) {
		TransportOrder order = document.getTransportOrderHorse().getTransportOrder();
		if (order.getStatus() != OrderStatus.APPROVED || order.getDocumentsLockedAt() != null) {
			throw new DocumentVersionConflictException("Order is not in an active document phase");
		}
	}

	private void updateHorseStatus(TransportOrderHorse orderHorse, OrderHorseDocumentStatus target,
			UUID actorUserId) {
		OrderHorseDocumentStatus previous = orderHorse.getDocumentStatus();
		if (previous == target) return;
		switch (target) {
			case INCOMPLETE -> orderHorse.markDocumentsIncomplete();
			case UNDER_REVIEW -> orderHorse.markDocumentsUnderReview();
			case NEEDS_REVISION -> orderHorse.markDocumentsNeedingRevision();
			case ELIGIBLE_FOR_EXPORT -> orderHorse.markDocumentsEligibleForExport();
		}
		auditRepository.saveAndFlush(StatusAuditLog.userTransition(AuditEntityType.TRANSPORT_ORDER_HORSE,
				orderHorse.getId(), previous.name(), target.name(), actorUserId, null));
	}

	private ValidatedFile validate(MultipartFile file) {
		if (file == null || file.isEmpty()) {
			throw new DocumentFileValidationException("A non-empty document file is required");
		}
		if (file.getSize() > MAX_FILE_SIZE) {
			throw new DocumentFileValidationException("Document file must not exceed 10 MB");
		}
		String contentType = file.getContentType();
		if (!ALLOWED_CONTENT_TYPES.contains(contentType)) {
			throw new DocumentFileValidationException("Only PDF, JPEG, and PNG documents are allowed");
		}
		try {
			byte[] content = file.getBytes();
			if (!matchesContentType(content, contentType)) {
				throw new DocumentFileValidationException("Document content does not match its MIME type");
			}
			return new ValidatedFile(content, contentType);
		}
		catch (IOException exception) {
			throw new DocumentFileValidationException("Document file could not be read");
		}
	}

	private boolean matchesContentType(byte[] content, String contentType) {
		return switch (contentType) {
			case "application/pdf" -> startsWith(content, new int[] {0x25, 0x50, 0x44, 0x46, 0x2D});
			case "image/jpeg" -> startsWith(content, new int[] {0xFF, 0xD8, 0xFF});
			case "image/png" -> startsWith(content,
					new int[] {0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A});
			default -> false;
		};
	}

	private boolean startsWith(byte[] content, int[] signature) {
		if (content.length < signature.length) return false;
		for (int index = 0; index < signature.length; index++) {
			if ((content[index] & 0xFF) != signature[index]) return false;
		}
		return true;
	}

	private String publicId(HorseDocument document, int versionNo) {
		UUID orderId = document.getTransportOrderHorse().getTransportOrder().getId();
		return "horse-transport/orders/" + orderId + "/documents/" + document.getId() + "/v" + versionNo;
	}

	private String replacementPublicId(HorseDocument document, int versionNo) {
		return publicId(document, versionNo) + "-replacement-" + UUID.randomUUID();
	}

	private void ensureUrlFitsSchema(String fileUrl) {
		if (fileUrl == null || fileUrl.isBlank() || fileUrl.length() > 500) {
			throw new DocumentStorageException("Stored document URL is invalid");
		}
	}

	private boolean registerDeleteOnRollback(String publicId) {
		if (!TransactionSynchronizationManager.isSynchronizationActive()) return false;
		TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
			@Override
			public void afterCompletion(int status) {
				if (status == TransactionSynchronization.STATUS_ROLLED_BACK) bestEffortDelete(publicId);
			}
		});
		return true;
	}

	private boolean registerReplacementCleanup(String previousUrl, String replacementPublicId) {
		if (!TransactionSynchronizationManager.isSynchronizationActive()) return false;
		TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
			@Override
			public void afterCommit() {
				bestEffortDeleteByUrl(previousUrl, "after document replacement");
			}

			@Override
			public void afterCompletion(int status) {
				if (status == TransactionSynchronization.STATUS_ROLLED_BACK) {
					bestEffortDelete(replacementPublicId);
				}
			}
		});
		return true;
	}

	private boolean registerDeleteAfterCommit(String fileUrl) {
		if (!TransactionSynchronizationManager.isSynchronizationActive()) return false;
		TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
			@Override
			public void afterCommit() {
				bestEffortDeleteByUrl(fileUrl, "after document deletion");
			}
		});
		return true;
	}

	private void bestEffortDelete(String publicId) {
		try {
			storage.delete(publicId);
		}
		catch (RuntimeException cleanupFailure) {
			LOGGER.warn("Could not clean up document object {} after database failure", publicId,
					cleanupFailure);
		}
	}

	private void bestEffortDeleteByUrl(String fileUrl, String operation) {
		try {
			storage.deleteByUrl(fileUrl);
		}
		catch (RuntimeException cleanupFailure) {
			LOGGER.warn("Could not clean up previous document object {}", operation, cleanupFailure);
		}
	}

	private record ValidatedFile(byte[] content, String contentType) {
	}
}
