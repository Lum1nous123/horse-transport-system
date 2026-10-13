package com.horsetransport.payment;

import java.util.UUID;

public record RemainingBalanceCheckoutResponse(
		UUID paymentId,
		UUID paymentAttemptId,
		String checkoutSessionId,
		String checkoutUrl,
		PaymentStatus paymentStatus) {
}
