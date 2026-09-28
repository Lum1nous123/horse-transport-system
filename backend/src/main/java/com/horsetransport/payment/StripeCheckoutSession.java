package com.horsetransport.payment;

public record StripeCheckoutSession(String id, String url, String paymentIntentId) {
}
