package com.horsetransport.payment;

public enum StripeEventKind {
	SUCCESS,
	FAILED,
	CANCELLED,
	EXPIRED,
	REFUND_SUCCESS,
	REFUND_FAILED,
	REFUND_PENDING,
	IGNORED
}
