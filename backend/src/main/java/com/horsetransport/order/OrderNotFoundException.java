package com.horsetransport.order;

public class OrderNotFoundException extends RuntimeException {
	public OrderNotFoundException() {
		super("Transport order was not found");
	}
}
