package com.horsetransport.document;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.horsetransport.order.OrderNotFoundException;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportSpecialistAssignmentGuard;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderHorse;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.payment.DocumentPhaseStarter;
import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DocumentChecklistService implements DocumentPhaseStarter {

	private static final Set<DocumentType> MANDATORY_TYPES = EnumSet.allOf(DocumentType.class);

	private final TransportOrderRepository orderRepository;
	private final HorseDocumentRepository documentRepository;
	private final HorseDocumentVersionRepository versionRepository;
	private final TransportSpecialistAssignmentGuard assignmentGuard;
	private final CurrentUserProvider currentUserProvider;

	public DocumentChecklistService(TransportOrderRepository orderRepository,
			HorseDocumentRepository documentRepository, HorseDocumentVersionRepository versionRepository,
			TransportSpecialistAssignmentGuard assignmentGuard, CurrentUserProvider currentUserProvider) {
		this.orderRepository = orderRepository;
		this.documentRepository = documentRepository;
		this.versionRepository = versionRepository;
		this.assignmentGuard = assignmentGuard;
		this.currentUserProvider = currentUserProvider;
	}

	@Override
	@Transactional(propagation = Propagation.MANDATORY)
	public void startForOrder(UUID orderId) {
		TransportOrder order = orderRepository.findByIdForUpdate(orderId).orElseThrow(OrderNotFoundException::new);
		if (order.getStatus() != OrderStatus.APPROVED) {
			throw new DocumentChecklistConflictException("Order must be APPROVED to generate its document checklist");
		}
		List<TransportOrderHorse> orderHorses = order.getHorses();
		if (orderHorses.isEmpty()) {
			throw new DocumentChecklistConflictException("Approved Order must contain at least one Horse");
		}

		List<HorseDocument> existing = findDocuments(orderHorses);
		Map<UUID, Set<DocumentType>> existingTypes = indexTypes(existing);
		List<HorseDocument> missing = new ArrayList<>();
		for (TransportOrderHorse orderHorse : orderHorses) {
			Set<DocumentType> types = existingTypes.getOrDefault(orderHorse.getId(), Set.of());
			for (DocumentType type : MANDATORY_TYPES) {
				if (!types.contains(type)) missing.add(new HorseDocument(orderHorse, type));
			}
		}
		if (!missing.isEmpty()) documentRepository.saveAllAndFlush(missing);
		ensureComplete(orderHorses, findDocuments(orderHorses));
	}

	@Transactional(readOnly = true)
	public DocumentChecklistResponse getChecklist(UUID orderId) {
		TransportOrder order = findVisibleOrder(orderId);
		List<TransportOrderHorse> orderHorses = order.getHorses();
		List<HorseDocument> documents = findDocuments(orderHorses);
		if (!isComplete(orderHorses, documents)) throw new DocumentChecklistNotFoundException();
		return toResponse(order, orderHorses, documents);
	}

	@Transactional
	public DocumentDeadlineResponse setDeadline(UUID orderId, SetDocumentDeadlineRequest request) {
		TransportOrder order = orderRepository.findByIdForUpdate(orderId).orElseThrow(OrderNotFoundException::new);
		assignmentGuard.requireAssignedToCurrentTransportSpecialist(orderId);
		if (order.getStatus() != OrderStatus.APPROVED) {
			throw new DocumentChecklistConflictException("Order must be APPROVED to set its document deadline");
		}
		if (order.getDocumentsLockedAt() != null) {
			throw new DocumentChecklistConflictException("Document Phase is permanently locked");
		}
		List<TransportOrderHorse> orderHorses = order.getHorses();
		ensureComplete(orderHorses, findDocuments(orderHorses));

		LocalDateTime requested = normalize(request.documentCompletionDeadlineAt());
		LocalDateTime existing = normalize(order.getDocumentCompletionDeadlineAt());
		if (existing != null && !existing.equals(requested)) {
			throw new DocumentChecklistConflictException("Document completion deadline has already been set");
		}
		if (existing == null) {
			order.setDocumentCompletionDeadline(requested, currentUserProvider.getCurrentUserId());
			orderRepository.saveAndFlush(order);
		}
		return new DocumentDeadlineResponse(order.getId(), order.getDocumentCompletionDeadlineAt(),
				order.getDocumentDeadlineSetAt());
	}

	@Transactional
	public DocumentChecklistResponse finalConfirm(UUID orderId) {
		TransportOrder order = orderRepository.findByIdForUpdate(orderId).orElseThrow(OrderNotFoundException::new);
		assignmentGuard.requireAssignedToCurrentTransportSpecialist(orderId);
		if (order.getStatus() != OrderStatus.APPROVED) {
			throw new DocumentChecklistConflictException("Order must be APPROVED to Final Confirm documents");
		}
		if (order.getDocumentsLockedAt() != null || order.getDocumentsFinalConfirmedAt() != null) {
			throw new DocumentChecklistConflictException("Document Phase has already been permanently locked");
		}

		List<TransportOrderHorse> orderHorses = order.getHorses();
		List<HorseDocument> documents = findDocuments(orderHorses);
		ensureComplete(orderHorses, documents);
		if (!allMandatoryDocumentsApproved(documents)) {
			throw new DocumentChecklistConflictException("All mandatory current documents must be APPROVED");
		}

		order.finalConfirmDocuments(currentUserProvider.getCurrentUserId());
		orderRepository.saveAndFlush(order);
		return toResponse(order, orderHorses, documents);
	}

	private TransportOrder findVisibleOrder(UUID orderId) {
		if (currentUserProvider.getCurrentUserRole() == UserRole.CUSTOMER) {
			return orderRepository.findByIdAndCustomerId(orderId, currentUserProvider.getCurrentUserId())
					.orElseThrow(OrderNotFoundException::new);
		}
		assignmentGuard.requireAssignedToCurrentTransportSpecialist(orderId);
		return orderRepository.findById(orderId).orElseThrow(OrderNotFoundException::new);
	}

	private List<HorseDocument> findDocuments(List<TransportOrderHorse> orderHorses) {
		if (orderHorses.isEmpty()) return List.of();
		return documentRepository.findAllByOrderHorseIds(orderHorses.stream()
				.map(TransportOrderHorse::getId).toList());
	}

	private Map<UUID, Set<DocumentType>> indexTypes(List<HorseDocument> documents) {
		Map<UUID, Set<DocumentType>> result = new HashMap<>();
		for (HorseDocument document : documents) {
			result.computeIfAbsent(document.getTransportOrderHorseId(), ignored -> new HashSet<>())
					.add(document.getDocumentType());
		}
		return result;
	}

	private boolean isComplete(List<TransportOrderHorse> orderHorses, List<HorseDocument> documents) {
		if (orderHorses.isEmpty()) return false;
		Map<UUID, Set<DocumentType>> types = indexTypes(documents);
		return orderHorses.stream().allMatch(orderHorse -> MANDATORY_TYPES.equals(types.get(orderHorse.getId())))
				&& documents.size() == orderHorses.size() * MANDATORY_TYPES.size();
	}

	private boolean allMandatoryDocumentsApproved(List<HorseDocument> documents) {
		if (documents.isEmpty()) return false;
		List<HorseDocumentVersion> currentVersions = versionRepository.findCurrentByHorseDocumentIds(
				documents.stream().map(HorseDocument::getId).toList());
		return currentVersions.size() == documents.size()
				&& currentVersions.stream().allMatch(version -> version.getStatus() == DocumentVersionStatus.APPROVED);
	}

	private void ensureComplete(List<TransportOrderHorse> orderHorses, List<HorseDocument> documents) {
		if (!isComplete(orderHorses, documents)) {
			throw new DocumentChecklistConflictException("Document checklist is incomplete");
		}
	}

	private DocumentChecklistResponse toResponse(TransportOrder order, List<TransportOrderHorse> orderHorses,
			List<HorseDocument> documents) {
		Map<UUID, List<HorseDocument>> byOrderHorse = new HashMap<>();
		for (HorseDocument document : documents) {
			byOrderHorse.computeIfAbsent(document.getTransportOrderHorseId(), ignored -> new ArrayList<>()).add(document);
		}
		List<HorseDocumentChecklistResponse> horses = orderHorses.stream()
				.sorted(Comparator.comparing(TransportOrderHorse::getId))
				.map(orderHorse -> new HorseDocumentChecklistResponse(orderHorse.getId(), orderHorse.getHorseId(),
						orderHorse.getDocumentStatus(), byOrderHorse.get(orderHorse.getId()).stream()
								.sorted(Comparator.comparing(HorseDocument::getDocumentType))
								.map(document -> new HorseDocumentItemResponse(document.getId(),
										document.getDocumentType(), true))
								.toList()))
				.toList();
		boolean locked = order.getDocumentsLockedAt() != null;
		boolean canFinalConfirm = order.getStatus() == OrderStatus.APPROVED && !locked
				&& allMandatoryDocumentsApproved(documents);
		return new DocumentChecklistResponse(order.getId(), order.getDocumentCompletionDeadlineAt(),
				order.getDocumentDeadlineSetAt(), canFinalConfirm, order.getDocumentsFinalConfirmedBy(),
				order.getDocumentsFinalConfirmedAt(), order.getDocumentsLockedAt(), horses);
	}

	private LocalDateTime normalize(LocalDateTime timestamp) {
		return timestamp == null ? null : timestamp.truncatedTo(ChronoUnit.MICROS);
	}
}
