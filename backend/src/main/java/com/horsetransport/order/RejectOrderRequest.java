package com.horsetransport.order;

import jakarta.validation.constraints.NotBlank;

public record RejectOrderRequest(
		@NotBlank(message = "rejectionReason is required")
		String rejectionReason) {

	public RejectOrderRequest {
		if (rejectionReason != null) {
			rejectionReason = rejectionReason.trim();
		}
	}
}
