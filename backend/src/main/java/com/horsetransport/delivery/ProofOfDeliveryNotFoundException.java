package com.horsetransport.delivery;

public class ProofOfDeliveryNotFoundException extends RuntimeException {
	public ProofOfDeliveryNotFoundException() {
		super("Proof of Delivery was not found");
	}
}
