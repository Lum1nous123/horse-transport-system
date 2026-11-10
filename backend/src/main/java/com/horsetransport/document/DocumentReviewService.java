package com.horsetransport.document;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.horsetransport.audit.AuditEntityType;
import com.horsetransport.audit.StatusAuditLog;
import com.horsetransport.audit.StatusAuditLogRepository;
import com.horsetransport.order.OrderHorseDocumentStatus;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderHorse;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.order.TransportSpecialistAssignmentGuard;
import com.horsetransport.security.CurrentUserProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DocumentReviewService {
	private final HorseDocumentRepository documentRepository;
	private final HorseDocumentVersionRepository versionRepository;
	private final TransportOrderRepository orderRepository;
	private final StatusAuditLogRepository auditRepository;
	private final TransportSpecialistAssignmentGuard assignmentGuard;
	private final DocumentDeadlineOrderProcessor deadlineOrderProcessor;
	private final CurrentUserProvider currentUserProvider;
	private final Clock clock;

	public DocumentReviewService(HorseDocumentRepository documentRepository,
			HorseDocumentVersionRepository versionRepository, TransportOrderRepository orderRepository,
			StatusAuditLogRepository auditRepository,
			TransportSpecialistAssignmentGuard assignmentGuard,
			DocumentDeadlineOrderProcessor deadlineOrderProcessor,
			CurrentUserProvider currentUserProvider, Clock clock) {
		this.documentRepository = documentRepository;
		this.versionRepository = versionRepository;
		this.orderRepository = orderRepository;
		this.auditRepository = auditRepository;
		this.assignmentGuard = assignmentGuard;
		this.deadlineOrderProcessor = deadlineOrderProcessor;
		this.currentUserProvider = currentUserProvider;
		this.clock = clock;
	}

	@Transactional
	public DocumentVersionResponse approve(UUID documentId, UUID versionId) {
		return review(documentId, versionId, null, true);
	}

	@Transactional
	public DocumentVersionResponse reject(UUID documentId, UUID versionId,
			RejectDocumentVersionRequest request) {
		if (request == null || request.rejectionReason() == null || request.rejectionReason().isBlank()) {
			throw new DocumentReviewValidationException("Rejection reason must not be blank");
		}
		return review(documentId, versionId, request.rejectionReason(), false);
	}

	private DocumentVersionResponse review(UUID documentId, UUID versionId, String reason,
			boolean approved) {
		UUID actorUserId = currentUserProvider.getCurrentUserId();
		HorseDocument document = findForReview(documentId);
		ensureActiveDocumentPhase(document);
		HorseDocumentVersion version = findVersion(documentId, versionId);
		TransportOrderHorse orderHorse = document.getTransportOrderHorse();
		TransportOrder order = orderHorse.getTransportOrder();
		OrderHorseDocumentStatus previousHorseStatus = orderHorse.getDocumentStatus();
		LocalDateTime previousCorrectionDeadline = document.getCorrectionDeadlineAt();
		int previousCorrectionWindowNo = document.getCorrectionWindowNo();
		boolean cancelAfterReview = false;

		if (approved) {
			version.approve(actorUserId, LocalDateTime.now(clock));
		}
		else {
			LocalDateTime rejectedAt = LocalDateTime.now(clock);
			version.requireReviewable();
			cancelAfterReview = applyCorrectionWindow(document,
					order.getDocumentCompletionDeadlineAt(), rejectedAt);
			version.reject(actorUserId, reason, rejectedAt);
		}

		try {
			version = versionRepository.saveAndFlush(version);
			auditRepository.saveAndFlush(StatusAuditLog.userTransition(
					AuditEntityType.HORSE_DOCUMENT_VERSION, version.getId(),
					DocumentVersionStatus.PENDING_REVIEW.name(), version.getStatus().name(),
					actorUserId, version.getRejectionReason()));
			updateHorseStatus(orderHorse, actorUserId);
			if (cancelAfterReview) {
				deadlineOrderProcessor.cancelAfterFinalCorrectionRejection(
						order.getId(), version.getReviewedAt(), actorUserId);
			}
			return DocumentVersionResponse.from(version);
		}
		catch (RuntimeException exception) {
			version.restorePendingAfterReviewFailure();
			document.restoreCorrectionWindow(previousCorrectionWindowNo, previousCorrectionDeadline);
			orderHorse.restoreDocumentStatus(previousHorseStatus);
			throw exception;
		}
	}

	private boolean applyCorrectionWindow(HorseDocument document, LocalDateTime originalDeadline,
			LocalDateTime rejectedAt) {
		if (originalDeadline == null || rejectedAt.isBefore(originalDeadline)) {
			return false;
		}

		int currentWindow = document.getCorrectionWindowNo();
		if (currentWindow == 0) {
			document.openCorrectionWindow(1, rejectedAt.plusHours(24));
			return false;
		}

		LocalDateTime currentDeadline = document.getCorrectionDeadlineAt();
		if (currentDeadline == null) {
			throw new DocumentReviewValidationException("Active correction window requires a deadline");
		}
		if (rejectedAt.isBefore(currentDeadline)) {
			return false;
		}
		if (currentWindow == 1) {
			document.openCorrectionWindow(2, rejectedAt.plusHours(24));
			return false;
		}
		return true;
	}

	private HorseDocumentVersion findVersion(UUID documentId, UUID versionId) {
		return versionRepository.findById(versionId)
				.filter(version -> version.getHorseDocumentId().equals(documentId))
				.orElseThrow(DocumentVersionNotFoundException::new);
	}

	private HorseDocument findForReview(UUID documentId) {
		HorseDocument visible = documentRepository.findById(documentId)
				.orElseThrow(HorseDocumentNotFoundException::new);
		UUID orderId = visible.getTransportOrderHorse().getTransportOrder().getId();
		assignmentGuard.requireAssignedToCurrentTransportSpecialist(orderId);
		orderRepository.findByIdForUpdate(orderId).orElseThrow(HorseDocumentNotFoundException::new);
		return documentRepository.findByIdForUpdate(documentId)
				.orElseThrow(HorseDocumentNotFoundException::new);
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
