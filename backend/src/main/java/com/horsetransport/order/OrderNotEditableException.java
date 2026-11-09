package com.horsetransport.order;

public class OrderNotEditableException extends RuntimeException {
	public OrderNotEditableException() {
		super("Only DRAFT or REJECTED transport orders can be edited or submitted");
	}
}
