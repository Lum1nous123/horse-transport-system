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
	private static final long MAX_REJECTIONS_PER_DOCUMENT = 2;
	private static final String CORRECTION_LIMIT_REASON = "Maximum document correction attempts reached";

	private final HorseDocumentRepository documentRepository;
	private final HorseDocumentVersionRepository versionRepository;
	private final TransportOrderRepository orderRepository;
	private final StatusAuditLogRepository auditRepository;
	private final TransportSpecialistAssignmentGuard assignmentGuard;
	private final CurrentUserProvider currentUserProvider;
	private final Clock clock;

	public DocumentReviewService(HorseDocumentRepository documentRepository,
			HorseDocumentVersionRepository versionRepository, TransportOrderRepository orderRepository,
			StatusAuditLogRepository auditRepository,
			TransportSpecialistAssignmentGuard assignmentGuard, CurrentUserProvider currentUserProvider,
			Clock clock) {
		this.documentRepository = documentRepository;
		this.versionRepository = versionRepository;
		this.orderRepository = orderRepository;
		this.auditRepository = auditRepository;
		this.assignmentGuard = assignmentGuard;
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

		if (approved) {
			version.approve(actorUserId, LocalDateTime.now(clock));
		}
		else {
			LocalDateTime rejectedAt = LocalDateTime.now(clock);
			version.requireReviewable();
			long rejectionCount = versionRepository.countByHorseDocument_IdAndStatus(
					documentId, DocumentVersionStatus.REJECTED);
			if (rejectionCount >= MAX_REJECTIONS_PER_DOCUMENT) {
				order.cancelForDocumentCorrectionLimit(rejectedAt);
				orderRepository.saveAndFlush(order);
				auditRepository.saveAndFlush(StatusAuditLog.userTransition(
						AuditEntityType.TRANSPORT_ORDER, order.getId(), OrderStatus.APPROVED.name(),
						OrderStatus.CANCELLED.name(), actorUserId, CORRECTION_LIMIT_REASON));
				return DocumentVersionResponse.from(version);
			}
			version.reject(actorUserId, reason, rejectedAt);
			document.openCorrectionWindow(correctionDeadline(order.getDocumentCompletionDeadlineAt(), rejectedAt));
		}

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
			document.restoreCorrectionDeadline(previousCorrectionDeadline);
			orderHorse.restoreDocumentStatus(previousHorseStatus);
			throw exception;
		}
	}

	private LocalDateTime correctionDeadline(LocalDateTime originalDeadline, LocalDateTime rejectedAt) {
		LocalDateTime minimumCorrectionWindow = rejectedAt.plusHours(24);
		return originalDeadline != null && originalDeadline.isAfter(minimumCorrectionWindow)
				? originalDeadline : minimumCorrectionWindow;
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
