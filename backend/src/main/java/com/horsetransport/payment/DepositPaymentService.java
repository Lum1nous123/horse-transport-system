package com.horsetransport.payment;

import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class DepositPaymentService {

	private final DepositPaymentTransactionService transactionService;
	private final RemainingBalancePaymentTransactionService remainingBalanceTransactionService;
	private final StripePaymentGateway stripeGateway;
	private final DepositRefundService refundService;

	@Autowired
	public DepositPaymentService(DepositPaymentTransactionService transactionService,
			RemainingBalancePaymentTransactionService remainingBalanceTransactionService,
			StripePaymentGateway stripeGateway, DepositRefundService refundService) {
		this.transactionService = transactionService;
		this.remainingBalanceTransactionService = remainingBalanceTransactionService;
		this.stripeGateway = stripeGateway;
		this.refundService = refundService;
	}

	DepositPaymentService(DepositPaymentTransactionService transactionService, StripePaymentGateway stripeGateway) {
		this(transactionService, null, stripeGateway, null);
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
		WebhookProcessingResult result;
		if (isRefundEvent(event.kind())) {
			result = refundService == null
					? new WebhookProcessingResult(false, false, false)
					: refundService.processRefundWebhook(event);
		} else if (PaymentType.REMAINING_BALANCE.name().equals(event.metadata().get("paymentType"))) {
			result = remainingBalanceTransactionService == null
					? new WebhookProcessingResult(false, false, false)
					: remainingBalanceTransactionService.processWebhook(event);
		} else {
			result = transactionService.processWebhook(event);
		}
		return new StripeWebhookResponse(result.processed(), result.duplicate(), result.orderApproved());
	}

	private boolean isRefundEvent(StripeEventKind kind) {
		return kind == StripeEventKind.REFUND_SUCCESS
				|| kind == StripeEventKind.REFUND_FAILED
				|| kind == StripeEventKind.REFUND_PENDING;
	}
}
