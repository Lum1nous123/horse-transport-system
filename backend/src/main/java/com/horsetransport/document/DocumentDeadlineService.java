package com.horsetransport.document;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.horsetransport.order.TransportOrderRepository;
import org.springframework.stereotype.Service;

@Service
public class DocumentDeadlineService {

	private final TransportOrderRepository orderRepository;
	private final DocumentDeadlineOrderProcessor orderProcessor;
	private final Clock clock;

	public DocumentDeadlineService(TransportOrderRepository orderRepository,
			DocumentDeadlineOrderProcessor orderProcessor, Clock clock) {
		this.orderRepository = orderRepository;
		this.orderProcessor = orderProcessor;
		this.clock = clock;
	}

	public DocumentDeadlineEvaluationResult evaluateDueOrders() {
		LocalDateTime evaluatedAt = LocalDateTime.now(clock);
		List<UUID> dueOrderIds = orderRepository.findDueDocumentDeadlineOrderIds(evaluatedAt);
		int cancelled = 0;
		for (UUID orderId : dueOrderIds) {
			if (orderProcessor.cancelForIncompleteDeadline(orderId, evaluatedAt)) cancelled++;
		}
		return new DocumentDeadlineEvaluationResult(dueOrderIds.size(), cancelled);
	}

	public boolean handlePostDeadlineRejection(UUID orderId) {
		return orderProcessor.cancelForPostDeadlineRejection(orderId, LocalDateTime.now(clock));
	}
}
