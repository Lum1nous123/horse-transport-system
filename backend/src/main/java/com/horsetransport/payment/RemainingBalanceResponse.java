package com.horsetransport.payment;

import java.math.BigDecimal;
import java.util.UUID;

public record RemainingBalanceResponse(
		UUID orderId,
		BigDecimal amount,
		String currency,
		String paymentStatus,
		boolean checkoutEligible,
		String ineligibleReason) {
}
