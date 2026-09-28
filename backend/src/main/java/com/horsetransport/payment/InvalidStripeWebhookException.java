package com.horsetransport.payment;

public class InvalidStripeWebhookException extends RuntimeException {

	public InvalidStripeWebhookException(String message, Throwable cause) {
		super(message, cause);
	}
}
