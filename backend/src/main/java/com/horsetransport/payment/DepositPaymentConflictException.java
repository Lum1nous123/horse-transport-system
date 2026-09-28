package com.horsetransport.payment;

public class DepositPaymentConflictException extends RuntimeException {

	public DepositPaymentConflictException(String message) {
		super(message);
	}
}
