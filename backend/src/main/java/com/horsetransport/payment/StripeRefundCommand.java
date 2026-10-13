package com.horsetransport.payment;

import java.util.Map;

public record StripeRefundCommand(String paymentIntentId, long amountMinor, String idempotencyKey,
		Map<String, String> metadata) { }
