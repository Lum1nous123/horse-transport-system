package com.horsetransport.payment;

public interface StripePaymentGateway {

	StripeCheckoutSession createCheckout(StripeCheckoutCommand command);

	StripeWebhookEvent verifyAndParseWebhook(String payload, String signature);
}
