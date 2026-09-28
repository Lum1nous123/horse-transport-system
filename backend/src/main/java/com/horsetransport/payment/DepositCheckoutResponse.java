package com.horsetransport.payment;

import java.util.UUID;

public record DepositCheckoutResponse(
		UUID paymentId,
		UUID paymentAttemptId,
		String checkoutSessionId,
		String checkoutUrl,
		PaymentStatus paymentStatus) {
}
