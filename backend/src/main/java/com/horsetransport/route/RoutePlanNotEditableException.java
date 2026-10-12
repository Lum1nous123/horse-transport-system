package com.horsetransport.route;

public class RoutePlanNotEditableException extends RuntimeException {
	public RoutePlanNotEditableException() {
		super("Only DRAFT or RETURNED route plans can be edited");
	}
}