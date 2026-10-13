package com.horsetransport.order;

public class UnassignedTransportSpecialistException extends RuntimeException {
	public UnassignedTransportSpecialistException() {
		super("Transport Specialist is not assigned to this Order");
	}
}
