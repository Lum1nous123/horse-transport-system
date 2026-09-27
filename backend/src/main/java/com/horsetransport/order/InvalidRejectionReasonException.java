package com.horsetransport.order;

public class InvalidRejectionReasonException extends RuntimeException {

	public InvalidRejectionReasonException() {
		super("rejectionReason is required");
	}
}
