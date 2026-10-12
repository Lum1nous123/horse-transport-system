package com.horsetransport.route;

public class RoutePlanNotFoundException extends RuntimeException {
	public RoutePlanNotFoundException() {
		super("Route plan was not found");
	}
}
