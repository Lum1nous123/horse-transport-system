package com.horsetransport.payment;

public interface StripePaymentGateway {

	StripeCheckoutSession createCheckout(StripeCheckoutCommand command);

	StripeRefundResult createRefund(StripeRefundCommand command);

	StripeWebhookEvent verifyAndParseWebhook(String payload, String signature);
}
