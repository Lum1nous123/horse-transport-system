package com.horsetransport.order;

import java.util.List;

public class OrderSubmissionValidationException extends RuntimeException {
	private final List<String> missingFields;

	public OrderSubmissionValidationException(List<String> missingFields) {
		super("Order cannot be submitted; missing required fields: " + String.join(", ", missingFields));
		this.missingFields = List.copyOf(missingFields);
	}

	public List<String> getMissingFields() {
		return missingFields;
	}
}
