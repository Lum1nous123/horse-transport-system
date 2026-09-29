package com.horsetransport.order;

public class UnsupportedOrderInboxStatusException extends RuntimeException {

	public UnsupportedOrderInboxStatusException() {
		super("Only SUBMITTED status is supported by the Logistics Manager inbox");
	}
}
