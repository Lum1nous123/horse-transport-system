package com.horsetransport.document;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class DocumentDeadlineScheduler {

	private static final Logger LOGGER = LoggerFactory.getLogger(DocumentDeadlineScheduler.class);

	private final DocumentDeadlineService deadlineService;

	public DocumentDeadlineScheduler(DocumentDeadlineService deadlineService) {
		this.deadlineService = deadlineService;
	}

	@Scheduled(fixedDelayString = "${app.document-deadline.scan-interval-ms:60000}")
	public void evaluateDueDocumentDeadlines() {
		DocumentDeadlineEvaluationResult result = deadlineService.evaluateDueOrders();
		if (result.cancelledOrders() > 0) {
			LOGGER.info("Document deadline scan evaluated {} orders and cancelled {}",
					result.evaluatedOrders(), result.cancelledOrders());
		}
		else if (result.evaluatedOrders() > 0) {
			LOGGER.debug("Document deadline scan evaluated {} orders with no cancellation",
					result.evaluatedOrders());
		}
	}
}
