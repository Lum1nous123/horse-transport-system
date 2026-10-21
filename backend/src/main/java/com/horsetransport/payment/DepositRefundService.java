package com.horsetransport.payment;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class DepositRefundService {
	private static final Logger LOGGER = LoggerFactory.getLogger(DepositRefundService.class);

	private final DepositRefundRepository refunds;
	private final DepositRefundProcessor processor;
	private final Clock clock;

	public DepositRefundService(DepositRefundRepository refunds, DepositRefundProcessor processor, Clock clock) {
		this.refunds = refunds;
		this.processor = processor;
		this.clock = clock;
	}

	public int processDueRefunds() {
		List<UUID> ids = refunds.findDueIds(LocalDateTime.now(clock), PageRequest.of(0, 100));
		for (UUID id : ids) {
			try {
				processor.processOne(id);
			}
			catch (RuntimeException ex) {
				LOGGER.error("Deposit refund processing failed for refund {}", id, ex);
			}
		}
		return ids.size();
	}

	public WebhookProcessingResult processRefundWebhook(StripeWebhookEvent event) {
		return processor.processRefundWebhook(event);
	}
}
