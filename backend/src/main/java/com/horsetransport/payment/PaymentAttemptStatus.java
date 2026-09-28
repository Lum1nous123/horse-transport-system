package com.horsetransport.payment;

public enum PaymentAttemptStatus {
	PENDING,
	OPEN,
	SUCCEEDED,
	CANCELLED,
	EXPIRED;

	public boolean isActive() {
		return this == PENDING || this == OPEN;
	}
}
