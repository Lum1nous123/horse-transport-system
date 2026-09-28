package com.horsetransport.payment;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

public record StripeCheckoutCommand(
		UUID orderId,
		BigDecimal amount,
		String currency,
		String idempotencyKey,
		Map<String, String> metadata) {
}
