package com.horsetransport.payment;

public record StripeRefundResult(String refundId, String paymentIntentId, Long amountMinor,
		String currency, String status) { }
