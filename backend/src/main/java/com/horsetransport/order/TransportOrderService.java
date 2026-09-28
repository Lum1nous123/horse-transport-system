package com.horsetransport.order;

import java.nio.ByteBuffer;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.horsetransport.audit.StatusAuditLog;
import com.horsetransport.audit.StatusAuditLogRepository;
import com.horsetransport.horse.HorseRepository;
import com.horsetransport.security.CurrentUserProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TransportOrderService {

	private static final Set<OrderStatus> CUSTOMER_CANCELLABLE_STATUSES =
			EnumSet.of(OrderStatus.DRAFT, OrderStatus.SUBMITTED, OrderStatus.QUOTATION_SENT);

	private final TransportOrderRepository orderRepository;
	private final HorseRepository horseRepository;
	private final StatusAuditLogRepository auditLogRepository;
	private final CurrentUserProvider currentUserProvider;

	public TransportOrderService(TransportOrderRepository orderRepository, HorseRepository horseRepository,
			StatusAuditLogRepository auditLogRepository, CurrentUserProvider currentUserProvider) {
		this.orderRepository = orderRepository;
		this.horseRepository = horseRepository;
		this.auditLogRepository = auditLogRepository;
		this.currentUserProvider = currentUserProvider;
	}

	@Transactional
	public OrderResponse create(UpdateOrderRequest request) {

		UUID customerId = currentUserProvider.getCurrentUserId();
		List<UUID> horseIds = validateOwnedHorses(request.safeHorseIds(), customerId);
		TransportOrder order = new TransportOrder(customerId, generateOrderCode());
		order.update(request, horseIds);
		return OrderResponse.from(orderRepository.save(order));
	}

	@Transactional(readOnly = true)
	public List<OrderResponse> findCurrentCustomerOrders() {
		UUID customerId = currentUserProvider.getCurrentUserId();
		return orderRepository.findAllByCustomerIdOrderByCreatedAtDesc(customerId).stream()
				.map(OrderResponse::from)
				.toList();
	}

	@Transactional(readOnly = true)
	public OrderResponse findCurrentCustomerOrder(UUID orderId) {
		return OrderResponse.from(findOwnedOrder(orderId, currentUserProvider.getCurrentUserId()));
	}

	@Transactional
	public OrderResponse update(UUID orderId, UpdateOrderRequest request) {
		UUID customerId = currentUserProvider.getCurrentUserId();
		TransportOrder order = findOwnedOrder(orderId, customerId);
		if (order.getStatus() != OrderStatus.DRAFT) {
			throw new OrderNotEditableException();
		}
		List<UUID> horseIds = validateOwnedHorses(request.safeHorseIds(), customerId);
		order.update(request, horseIds);
		return OrderResponse.from(orderRepository.save(order));
	}

	@Transactional
	public OrderResponse submit(UUID orderId) {
		UUID customerId = currentUserProvider.getCurrentUserId();
		TransportOrder order = findOwnedOrder(orderId, customerId);
		if (order.getStatus() != OrderStatus.DRAFT) {
			throw new OrderNotEditableException();
		}
		validateSubmission(order);

		order.submit();
		orderRepository.save(order);
		try {
			auditLogRepository.saveAndFlush(StatusAuditLog.userTransition(
					order.getId(), OrderStatus.DRAFT.name(), OrderStatus.SUBMITTED.name(), customerId));
		} catch (RuntimeException exception) {
			// The transaction rollback protects the database; restoring also avoids leaking
			// a misleading managed/in-memory state after a flush failure.
			order.restoreDraft();
			throw exception;
		}
		return OrderResponse.from(order);
	}

	@Transactional
	public OrderResponse cancel(UUID orderId) {
		UUID actorUserId = currentUserProvider.getCurrentUserId();
		TransportOrder order = orderRepository.findOwnedByIdForUpdate(orderId, actorUserId)
				.orElseThrow(OrderNotFoundException::new);
		OrderStatus oldStatus = order.getStatus();
		if (!CUSTOMER_CANCELLABLE_STATUSES.contains(oldStatus)) {
			throw new InvalidOrderTransitionException(oldStatus, "cancelled");
		}

		String oldRejectionReason = order.getRejectionReason();
		String oldCancellationReason = order.getCancellationReason();
		LocalDateTime oldCancelledAt = order.getCancelledAt();
		order.cancel();
		orderRepository.save(order);
		try {
			auditLogRepository.saveAndFlush(StatusAuditLog.userTransition(
					order.getId(), oldStatus.name(), OrderStatus.CANCELLED.name(), actorUserId, null));
		} catch (RuntimeException exception) {
			order.restoreTransition(oldStatus, oldRejectionReason, oldCancellationReason, oldCancelledAt);
			throw exception;
		}
		return OrderResponse.from(order);
	}

	@Transactional
	public OrderResponse reject(UUID orderId, RejectOrderRequest request) {
		if (request == null || request.rejectionReason() == null || request.rejectionReason().isBlank()) {
			throw new InvalidRejectionReasonException();
		}
		UUID actorUserId = currentUserProvider.getCurrentUserId();
		TransportOrder order = orderRepository.findById(orderId).orElseThrow(OrderNotFoundException::new);
		OrderStatus oldStatus = order.getStatus();
		if (oldStatus != OrderStatus.SUBMITTED) {
			throw new InvalidOrderTransitionException(oldStatus, "rejected");
		}

		String oldRejectionReason = order.getRejectionReason();
		String oldCancellationReason = order.getCancellationReason();
		LocalDateTime oldCancelledAt = order.getCancelledAt();
		order.reject(request.rejectionReason());
		orderRepository.save(order);
		try {
			auditLogRepository.saveAndFlush(StatusAuditLog.userTransition(
					order.getId(), oldStatus.name(), OrderStatus.REJECTED.name(), actorUserId,
					order.getRejectionReason()));
		} catch (RuntimeException exception) {
			order.restoreTransition(oldStatus, oldRejectionReason, oldCancellationReason, oldCancelledAt);
			throw exception;
		}
		return OrderResponse.from(order);
	}

	private TransportOrder findOwnedOrder(UUID orderId, UUID customerId) {
		return orderRepository.findByIdAndCustomerId(orderId, customerId)
				.orElseThrow(OrderNotFoundException::new);
	}

	private List<UUID> validateOwnedHorses(List<UUID> horseIds, UUID customerId) {
		if (horseIds.stream().anyMatch(java.util.Objects::isNull)) {
			throw new InvalidOrderHorsesException("horseIds must not contain null values");
		}

		Set<UUID> uniqueIds = new HashSet<>(horseIds);
		if (uniqueIds.size() != horseIds.size()) {
			throw new InvalidOrderHorsesException("The same horse cannot be attached more than once");
		}
		if (!uniqueIds.isEmpty()
				&& horseRepository.findAllByIdInAndCustomerId(uniqueIds, customerId).size() != uniqueIds.size()) {
			throw new InvalidOrderHorsesException("Every horse must exist and belong to the current customer");
		}
		return List.copyOf(horseIds);
	}

	private void validateSubmission(TransportOrder order) {
		List<String> missing = new ArrayList<>();
		if (isBlank(order.getOriginAddress()) && isBlank(order.getOriginCountry()))
			missing.add("origin");
		if (isBlank(order.getDestinationAddress()) && isBlank(order.getDestinationCountry()))
			missing.add("destination");
		if (order.getRequestedDepartureAt() == null)
			missing.add("requestedDepartureAt");
		if (order.getTransportMode() == null)
			missing.add("transportMode");
		if (order.getHorses().isEmpty())
			missing.add("horseIds");
		if (isBlank(order.getRecipientName()))
			missing.add("recipientName");
		if (isBlank(order.getRecipientPhone()))
			missing.add("recipientPhone");
		if (!missing.isEmpty())
			throw new OrderSubmissionValidationException(missing);
	}

	private boolean isBlank(String value) {
		return value == null || value.isBlank();
	}

	private String generateOrderCode() {
		UUID uuid = UUID.randomUUID();
		byte[] bytes = ByteBuffer.allocate(16).putLong(uuid.getMostSignificantBits())
				.putLong(uuid.getLeastSignificantBits()).array();
		return "ORD-" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}
}
