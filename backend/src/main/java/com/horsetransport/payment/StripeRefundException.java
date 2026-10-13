package com.horsetransport.payment;

public class StripeRefundException extends RuntimeException {
	public StripeRefundException(String message, Throwable cause) { super(message, cause); }
}
