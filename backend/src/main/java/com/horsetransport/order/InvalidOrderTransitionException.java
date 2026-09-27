package com.horsetransport.order;

public class InvalidOrderTransitionException extends RuntimeException {

	public InvalidOrderTransitionException(OrderStatus currentStatus, String action) {
		super("Transport order in " + currentStatus + " status cannot be " + action);
	}
}
