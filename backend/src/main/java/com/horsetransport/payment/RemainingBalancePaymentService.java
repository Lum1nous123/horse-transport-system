package com.horsetransport.payment;

import java.util.UUID;

import org.springframework.stereotype.Service;

@Service
public class RemainingBalancePaymentService {

	private final RemainingBalancePaymentTransactionService transactionService;
	private final StripePaymentGateway stripeGateway;

	public RemainingBalancePaymentService(RemainingBalancePaymentTransactionService transactionService,
			StripePaymentGateway stripeGateway) {
		this.transactionService = transactionService;
		this.stripeGateway = stripeGateway;
	}

	public RemainingBalanceCheckoutResponse createCheckout(UUID orderId) {
		PreparedRemainingBalanceCheckout prepared = transactionService.prepareCheckout(orderId);
		StripeCheckoutSession session = stripeGateway.createCheckout(prepared.command());
		return transactionService.attachCheckoutSession(prepared.payment().getId(), prepared.attempt().getId(),
				session);
	}

	public RemainingBalanceResponse getRemainingBalance(UUID orderId) {
		return transactionService.getRemainingBalance(orderId);
	}
}
