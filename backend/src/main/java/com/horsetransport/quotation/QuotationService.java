package com.horsetransport.quotation;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.horsetransport.audit.AuditEntityType;
import com.horsetransport.audit.StatusAuditLog;
import com.horsetransport.audit.StatusAuditLogRepository;
import com.horsetransport.order.InvalidOrderTransitionException;
import com.horsetransport.order.OrderNotFoundException;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserRole;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QuotationService {

	private final QuotationRepository quotationRepository;
	private final TransportOrderRepository orderRepository;
	private final StatusAuditLogRepository auditLogRepository;
	private final CurrentUserProvider currentUserProvider;

	public QuotationService(QuotationRepository quotationRepository, TransportOrderRepository orderRepository,
			StatusAuditLogRepository auditLogRepository, CurrentUserProvider currentUserProvider) {
		this.quotationRepository = quotationRepository;
		this.orderRepository = orderRepository;
		this.auditLogRepository = auditLogRepository;
		this.currentUserProvider = currentUserProvider;
	}

	@Transactional
	public QuotationResponse create(UUID orderId) {
		UUID actorUserId = currentUserProvider.getCurrentUserId();
		TransportOrder order = findOrder(orderId);
		if (order.getStatus() != OrderStatus.SUBMITTED) {
			throw new InvalidOrderTransitionException(order.getStatus(), "quoted");
		}
		if (quotationRepository.existsByTransportOrderId(orderId)) {
			throw new DuplicateQuotationException();
		}

		Quotation quotation = new Quotation(orderId, actorUserId);
		try {
			return QuotationResponse.from(quotationRepository.saveAndFlush(quotation));
		}
		catch (DataIntegrityViolationException exception) {
			throw new DuplicateQuotationException();
		}
	}

	@Transactional
	public QuotationResponse update(UUID orderId, UpdateQuotationRequest request) {
		TransportOrder order = findOrderForUpdate(orderId);
		Quotation quotation = findQuotation(orderId);
		if (quotation.getStatus() != QuotationStatus.DRAFT || order.getStatus() != OrderStatus.SUBMITTED) {
			throw new QuotationNotEditableException();
		}

		validateDraft(request);
		quotation.replace(request);
		return QuotationResponse.from(quotationRepository.save(quotation));
	}

	@Transactional(readOnly = true)
	public QuotationResponse get(UUID orderId) {
		UserRole role = currentUserProvider.getCurrentUserRole();
		if (role == UserRole.CUSTOMER) {
			UUID customerId = currentUserProvider.getCurrentUserId();
			orderRepository.findByIdAndCustomerId(orderId, customerId)
					.orElseThrow(OrderNotFoundException::new);
			Quotation quotation = findQuotation(orderId);
			if (quotation.getStatus() != QuotationStatus.SENT) {
				throw new QuotationNotFoundException();
			}
			return QuotationResponse.from(quotation);
		}
		if (role == UserRole.LOGISTICS_MANAGER) {
			return QuotationResponse.from(findQuotation(orderId));
		}
		throw new QuotationNotFoundException();
	}

	@Transactional
	public QuotationResponse send(UUID orderId) {
		UUID actorUserId = currentUserProvider.getCurrentUserId();
		TransportOrder order = findOrderForUpdate(orderId);
		Quotation quotation = findQuotation(orderId);
		if (quotation.getStatus() != QuotationStatus.DRAFT) {
			throw new QuotationNotEditableException();
		}
		if (order.getStatus() != OrderStatus.SUBMITTED) {
			throw new InvalidOrderTransitionException(order.getStatus(), "quoted");
		}
		validateForSend(quotation);

		quotation.send();
		order.markQuotationSent();
		try {
			quotationRepository.save(quotation);
			orderRepository.save(order);
			StatusAuditLog quotationAudit = StatusAuditLog.userTransition(
					AuditEntityType.QUOTATION, quotation.getId(), QuotationStatus.DRAFT.name(),
					QuotationStatus.SENT.name(), actorUserId, null);
			StatusAuditLog orderAudit = StatusAuditLog.userTransition(
					AuditEntityType.TRANSPORT_ORDER, order.getId(), OrderStatus.SUBMITTED.name(),
					OrderStatus.QUOTATION_SENT.name(), actorUserId, null);
			auditLogRepository.saveAllAndFlush(List.of(quotationAudit, orderAudit));
		}
		catch (RuntimeException exception) {
			quotation.restoreDraftAfterSendFailure();
			order.restoreSubmittedAfterQuotationSendFailure();
			throw exception;
		}
		return QuotationResponse.from(quotation);
	}

	private void validateDraft(UpdateQuotationRequest request) {
		if (request == null) {
			throw new QuotationValidationException("Quotation request is required");
		}
		List<QuotationLineItemRequest> items;
		try {
			items = request.safeLineItems();
		}
		catch (NullPointerException exception) {
			throw new QuotationValidationException("Line items must not contain null values");
		}

		Set<Integer> sequenceNumbers = new HashSet<>();
		BigDecimal total = BigDecimal.ZERO;
		for (QuotationLineItemRequest item : items) {
			if (item == null) {
				throw new QuotationValidationException("Line items must not contain null values");
			}
			if (item.sequenceNo() == null || item.sequenceNo() <= 0) {
				throw new QuotationValidationException("sequenceNo must be greater than zero");
			}
			if (!sequenceNumbers.add(item.sequenceNo())) {
				throw new QuotationValidationException("sequenceNo must be unique within the quotation");
			}
			if (item.description() == null || item.description().isBlank() || item.description().length() > 255) {
				throw new QuotationValidationException("description must not be blank and must not exceed 255 characters");
			}
			if (item.amount() == null || item.amount().compareTo(BigDecimal.ZERO) <= 0) {
				throw new QuotationValidationException("amount must be greater than zero");
			}
			total = total.add(item.amount());
		}

		BigDecimal deposit = request.depositAmount();
		if (deposit != null && (deposit.compareTo(BigDecimal.ZERO) <= 0 || items.isEmpty()
				|| deposit.compareTo(total) >= 0)) {
			throw new QuotationValidationException("depositAmount must be greater than zero and less than totalAmount");
		}
	}

	private void validateForSend(Quotation quotation) {
		if (quotation.getLineItems().isEmpty() || quotation.getTotalAmount() == null
				|| quotation.getTotalAmount().compareTo(BigDecimal.ZERO) <= 0) {
			throw new QuotationValidationException("At least one valid line item is required before sending");
		}
		if (quotation.getDepositAmount() == null
				|| quotation.getDepositAmount().compareTo(BigDecimal.ZERO) <= 0
				|| quotation.getDepositAmount().compareTo(quotation.getTotalAmount()) >= 0) {
			throw new QuotationValidationException(
					"depositAmount must be greater than zero and less than totalAmount before sending");
		}
		BigDecimal expectedRemaining = quotation.getTotalAmount().subtract(quotation.getDepositAmount());
		if (quotation.getRemainingAmount() == null
				|| quotation.getRemainingAmount().compareTo(expectedRemaining) != 0) {
			throw new QuotationValidationException("Quotation amounts are inconsistent");
		}
	}

	private TransportOrder findOrder(UUID orderId) {
		return orderRepository.findById(orderId).orElseThrow(OrderNotFoundException::new);
	}

	private TransportOrder findOrderForUpdate(UUID orderId) {
		return orderRepository.findByIdForUpdate(orderId).orElseThrow(OrderNotFoundException::new);
	}

	private Quotation findQuotation(UUID orderId) {
		return quotationRepository.findByTransportOrderId(orderId)
				.orElseThrow(QuotationNotFoundException::new);
	}
}
