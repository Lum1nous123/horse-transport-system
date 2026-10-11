package com.horsetransport.payment;

import java.util.UUID;

import org.springframework.stereotype.Service;

@Service
public class DepositPaymentService {

	private final DepositPaymentTransactionService transactionService;
    private final RemainingBalancePaymentTransactionService remainingBalanceTransactionService;
    private final StripePaymentGateway stripeGateway;

    public DepositPaymentService(DepositPaymentTransactionService transactionService,
		RemainingBalancePaymentTransactionService remainingBalanceTransactionService,
		StripePaymentGateway stripeGateway) {
	this.transactionService = transactionService;
	this.remainingBalanceTransactionService = remainingBalanceTransactionService;
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
	WebhookProcessingResult result = processWebhookByPaymentType(event);
	return new StripeWebhookResponse(result.processed(), result.duplicate(), result.orderApproved());
    }

    private WebhookProcessingResult processWebhookByPaymentType(StripeWebhookEvent event) {
	String paymentType = event.metadata().get("paymentType");

	if (PaymentType.REMAINING_BALANCE.name().equals(paymentType)) {
		return remainingBalanceTransactionService.processWebhook(event);
	}

	return transactionService.processWebhook(event);
    }
}
