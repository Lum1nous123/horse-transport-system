package com.horsetransport.payment;

import java.util.Map;

public record StripeWebhookEvent(
		String eventId,
		String eventType,
		StripeEventKind kind,
		String checkoutSessionId,
		String paymentIntentId,
		Long amountMinor,
		String currency,
		Map<String, String> metadata) {
}
