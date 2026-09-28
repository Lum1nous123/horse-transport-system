package com.horsetransport.payment;

public class DepositPaymentNotFoundException extends RuntimeException {

	public DepositPaymentNotFoundException() {
		super("Deposit payment was not found");
	}
}
