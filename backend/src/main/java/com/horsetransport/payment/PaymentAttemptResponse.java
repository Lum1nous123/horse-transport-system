package com.horsetransport.payment;

import java.time.LocalDateTime;
import java.util.UUID;

public record PaymentAttemptResponse(
		UUID id,
		int attemptNo,
		PaymentAttemptStatus providerStatus,
		String providerCheckoutSessionId,
		LocalDateTime initiatedAt,
		LocalDateTime succeededAt) {

	static PaymentAttemptResponse from(PaymentAttempt attempt) {
		return attempt == null ? null : new PaymentAttemptResponse(attempt.getId(), attempt.getAttemptNo(),
				attempt.getProviderStatus(), attempt.getProviderCheckoutSessionId(), attempt.getInitiatedAt(),
				attempt.getSucceededAt());
	}
}
