package com.horsetransport.document;

import java.util.List;
import java.util.UUID;

import com.horsetransport.audit.AuditEntityType;
import com.horsetransport.audit.StatusAuditLog;
import com.horsetransport.audit.StatusAuditLogRepository;
import com.horsetransport.order.OrderHorseDocumentStatus;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderHorse;
import com.horsetransport.security.CurrentUserProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DocumentReviewService {

	private final HorseDocumentRepository documentRepository;
	private final HorseDocumentVersionRepository versionRepository;
	private final StatusAuditLogRepository auditRepository;
	private final CurrentUserProvider currentUserProvider;

	public DocumentReviewService(HorseDocumentRepository documentRepository,
			HorseDocumentVersionRepository versionRepository, StatusAuditLogRepository auditRepository,
			CurrentUserProvider currentUserProvider) {
		this.documentRepository = documentRepository;
		this.versionRepository = versionRepository;
		this.auditRepository = auditRepository;
		this.currentUserProvider = currentUserProvider;
	}

	@Transactional
	public DocumentVersionResponse approve(UUID documentId, UUID versionId) {
		return review(documentId, versionId, null, true);
	}

	@Transactional
	public DocumentVersionResponse reject(UUID documentId, UUID versionId,
			RejectDocumentVersionRequest request) {
		if (request == null) {
			throw new DocumentReviewValidationException("Rejection reason must not be blank");
		}
		return review(documentId, versionId, request.rejectionReason(), false);
	}

	private DocumentVersionResponse review(UUID documentId, UUID versionId, String reason,
			boolean approved) {
		UUID actorUserId = currentUserProvider.getCurrentUserId();
		HorseDocument document = documentRepository.findByIdForUpdate(documentId)
				.orElseThrow(HorseDocumentNotFoundException::new);
		ensureActiveDocumentPhase(document);
		HorseDocumentVersion version = findVersion(documentId, versionId);
		TransportOrderHorse orderHorse = document.getTransportOrderHorse();
		OrderHorseDocumentStatus previousHorseStatus = orderHorse.getDocumentStatus();

		if (approved) version.approve(actorUserId);
		else version.reject(actorUserId, reason);

		try {
			version = versionRepository.saveAndFlush(version);
			auditRepository.saveAndFlush(StatusAuditLog.userTransition(
					AuditEntityType.HORSE_DOCUMENT_VERSION, version.getId(),
					DocumentVersionStatus.PENDING_REVIEW.name(), version.getStatus().name(),
					actorUserId, version.getRejectionReason()));
			updateHorseStatus(orderHorse, actorUserId);
			return DocumentVersionResponse.from(version);
		}
		catch (RuntimeException exception) {
			version.restorePendingAfterReviewFailure();
			orderHorse.restoreDocumentStatus(previousHorseStatus);
			throw exception;
		}
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

	private void updateHorseStatus(TransportOrderHorse orderHorse, UUID actorUserId) {
		List<HorseDocumentVersion> currentVersions = versionRepository.findCurrentByOrderHorseId(
				orderHorse.getId());
		OrderHorseDocumentStatus target = HorseDocumentStatusResolver.resolve(currentVersions);
		OrderHorseDocumentStatus previous = orderHorse.getDocumentStatus();
		if (previous == target) return;

		switch (target) {
			case INCOMPLETE -> orderHorse.markDocumentsIncomplete();
			case UNDER_REVIEW -> orderHorse.markDocumentsUnderReview();
			case NEEDS_REVISION -> orderHorse.markDocumentsNeedingRevision();
			case ELIGIBLE_FOR_EXPORT -> orderHorse.markDocumentsEligibleForExport();
		}
		auditRepository.saveAndFlush(StatusAuditLog.userTransition(
				AuditEntityType.TRANSPORT_ORDER_HORSE, orderHorse.getId(), previous.name(),
				target.name(), actorUserId, null));
	}
}
