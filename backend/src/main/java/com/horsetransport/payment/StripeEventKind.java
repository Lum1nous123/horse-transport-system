package com.horsetransport.payment;

public enum StripeEventKind {
	SUCCESS,
	FAILED,
	CANCELLED,
	EXPIRED,
	IGNORED
}
