package com.horsetransport.payment;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;

@Service
public class DepositPaymentService {

	private final DepositPaymentTransactionService transactionService;
	private final StripePaymentGateway stripeGateway;
	private final DepositRefundService refundService;

	@Autowired
	public DepositPaymentService(DepositPaymentTransactionService transactionService,
			StripePaymentGateway stripeGateway, DepositRefundService refundService) {
		this.transactionService = transactionService;
		this.stripeGateway = stripeGateway;
		this.refundService = refundService;
	}

	DepositPaymentService(DepositPaymentTransactionService transactionService, StripePaymentGateway stripeGateway) {
		this.transactionService = transactionService;
		this.stripeGateway = stripeGateway;
		this.refundService = null;
	}

	public DepositCheckoutResponse createCheckout(UUID orderId) {
		PreparedDepositCheckout prepared = transactionService.prepareCheckout(orderId);
		StripeCheckoutSession session = stripeGateway.createCheckout(prepared.command());
		return transactionService.attachCheckoutSession(prepared.payment().getId(), prepared.attempt().getId(),
				session);
	}

	public DepositPaymentResponse getDeposit(UUID orderId) {
		return transactionService.getDeposit(orderId);
	}

	public StripeWebhookResponse handleWebhook(String payload, String signature) {
		StripeWebhookEvent event = stripeGateway.verifyAndParseWebhook(payload, signature);
		WebhookProcessingResult result = switch (event.kind()) {
			case REFUND_SUCCESS, REFUND_FAILED, REFUND_PENDING -> refundService == null
					? new WebhookProcessingResult(false, false, false) : refundService.processRefundWebhook(event);
			default -> transactionService.processWebhook(event);
		};
		return new StripeWebhookResponse(result.processed(), result.duplicate(), result.orderApproved());
	}
}
