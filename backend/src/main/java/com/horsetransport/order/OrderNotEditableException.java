package com.horsetransport.order;

public class OrderNotEditableException extends RuntimeException {
	public OrderNotEditableException() {
		super("Only DRAFT transport orders can be edited or submitted");
	}
}
