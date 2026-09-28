package com.horsetransport.payment;

import java.util.UUID;

import org.springframework.stereotype.Service;

@Service
public class DepositPaymentService {

	private final DepositPaymentTransactionService transactionService;
	private final StripePaymentGateway stripeGateway;

	public DepositPaymentService(DepositPaymentTransactionService transactionService,
			StripePaymentGateway stripeGateway) {
		this.transactionService = transactionService;
		this.stripeGateway = stripeGateway;
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
		WebhookProcessingResult result = transactionService.processWebhook(event);
		return new StripeWebhookResponse(result.processed(), result.duplicate(), result.orderApproved());
	}
}
