package com.horsetransport.payment;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class DepositRefundScheduler {
	private final DepositRefundService refundService;
	public DepositRefundScheduler(DepositRefundService refundService) { this.refundService = refundService; }
	@Scheduled(fixedDelayString = "${app.payments.refund-scan-interval-ms:30000}")
	public void processDueRefunds() { refundService.processDueRefunds(); }
}
