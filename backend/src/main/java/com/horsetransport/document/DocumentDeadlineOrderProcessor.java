package com.horsetransport.document;

import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DocumentDeadlineOrderProcessor {

	private static final Set<DocumentType> MANDATORY_TYPES = EnumSet.allOf(DocumentType.class);
	private static final String REFUND_IDEMPOTENCY_PREFIX = "document-deadline-refund-";

	private final TransportOrderRepository orderRepository;
	private final HorseDocumentRepository documentRepository;
	private final HorseDocumentVersionRepository versionRepository;
	private final PaymentRepository paymentRepository;
	private final DepositRefundRepository refundRepository;
	private final StatusAuditLogRepository auditRepository;

	public DocumentDeadlineOrderProcessor(TransportOrderRepository orderRepository,
			HorseDocumentRepository documentRepository, HorseDocumentVersionRepository versionRepository,
			PaymentRepository paymentRepository, DepositRefundRepository refundRepository,
			StatusAuditLogRepository auditRepository) {
		this.orderRepository = orderRepository;
		this.documentRepository = documentRepository;
		this.versionRepository = versionRepository;
		this.paymentRepository = paymentRepository;
		this.refundRepository = refundRepository;
		this.auditRepository = auditRepository;
	}

	@Transactional
	public boolean cancelForIncompleteDeadline(UUID orderId, LocalDateTime evaluatedAt) {
		TransportOrder order = orderRepository.findByIdForUpdate(orderId).orElse(null);
		if (!isActiveDeadlineOrder(order, evaluatedAt)) return false;

		List<TransportOrderHorse> horses = order.getHorses();
		List<HorseDocument> documents = horses.isEmpty() ? List.of()
				: documentRepository.findAllByOrderHorseIds(horses.stream().map(TransportOrderHorse::getId).toList());
		if (!hasDeadlineFailure(horses, documents)) return false;

		cancelAndRequestRefund(order, evaluatedAt);
		return true;
	}

	@Transactional
	public boolean cancelForPostDeadlineRejection(UUID orderId, LocalDateTime rejectedAt) {
		TransportOrder order = orderRepository.findByIdForUpdate(orderId).orElse(null);
		if (order == null || order.getStatus() != OrderStatus.APPROVED
				|| order.getDocumentCompletionDeadlineAt() == null
				|| !rejectedAt.isAfter(order.getDocumentCompletionDeadlineAt())
				|| order.getDocumentsLockedAt() != null || order.getDocumentsFinalConfirmedAt() != null) {
			return false;
		}

		cancelAndRequestRefund(order, rejectedAt);
		return true;
	}

	private boolean isActiveDeadlineOrder(TransportOrder order, LocalDateTime evaluatedAt) {
		return order != null && order.getStatus() == OrderStatus.APPROVED
				&& order.getDocumentCompletionDeadlineAt() != null
				&& !evaluatedAt.isBefore(order.getDocumentCompletionDeadlineAt())
				&& order.getDocumentsLockedAt() == null && order.getDocumentsFinalConfirmedAt() == null;
	}

	private boolean hasDeadlineFailure(List<TransportOrderHorse> horses,
			List<HorseDocument> documents) {
		if (horses.isEmpty()) return true;
		Map<UUID, Set<DocumentType>> typesByHorse = new HashMap<>();
		for (HorseDocument document : documents) {
			typesByHorse.computeIfAbsent(document.getTransportOrderHorseId(), ignored -> new HashSet<>())
					.add(document.getDocumentType());
		}
		for (TransportOrderHorse horse : horses) {
			if (!typesByHorse.getOrDefault(horse.getId(), Set.of()).containsAll(MANDATORY_TYPES)) return true;
		}

		List<UUID> documentIds = documents.stream().map(HorseDocument::getId).toList();
		Map<UUID, HorseDocumentVersion> currentByDocument = new HashMap<>();
		if (!documentIds.isEmpty()) {
			versionRepository.findCurrentByHorseDocumentIds(documentIds)
					.forEach(version -> currentByDocument.put(version.getHorseDocumentId(), version));
		}
		for (HorseDocument document : documents) {
			HorseDocumentVersion current = currentByDocument.get(document.getId());
			if (current == null || current.getStatus() == DocumentVersionStatus.DRAFT
					|| current.getStatus() == DocumentVersionStatus.REJECTED) return true;
		}
		return false;
	}

	private void cancelAndRequestRefund(TransportOrder order, LocalDateTime cancelledAt) {
		Payment payment = paymentRepository.findByTransportOrderIdAndPaymentType(
				order.getId(), PaymentType.DEPOSIT)
			.orElseThrow(() -> new IllegalStateException("Approved Order has no Deposit payment"));
		if (payment.getStatus() != PaymentStatus.PAID) {
			throw new IllegalStateException("Approved Order Deposit is not PAID");
		}

		OrderStatus previousStatus = order.getStatus();
		order.cancelForDocumentDeadline(cancelledAt);
		orderRepository.saveAndFlush(order);
		auditRepository.saveAndFlush(StatusAuditLog.systemTransition(AuditEntityType.TRANSPORT_ORDER,
				order.getId(), previousStatus.name(), OrderStatus.CANCELLED.name(), cancelledAt));
		refundRepository.findByPaymentId(payment.getId()).orElseGet(() -> refundRepository.saveAndFlush(
				new DepositRefund(payment.getId(), REFUND_IDEMPOTENCY_PREFIX + payment.getId(), cancelledAt)));
	}
}
