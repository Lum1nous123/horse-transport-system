package com.horsetransport.order;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.Size;

public record UpdateOrderRequest(
		@Size(max = 255, message = "originAddress must not exceed 255 characters") String originAddress,
		@Size(max = 100, message = "originCountry must not exceed 100 characters") String originCountry,
		@Size(max = 255, message = "destinationAddress must not exceed 255 characters") String destinationAddress,
		@Size(max = 100, message = "destinationCountry must not exceed 100 characters") String destinationCountry,
		LocalDateTime requestedDepartureAt,
		TransportMode transportMode,
		String specialRequirements,
		@Size(max = 150, message = "recipientName must not exceed 150 characters") String recipientName,
		@Size(max = 30, message = "recipientPhone must not exceed 30 characters") String recipientPhone,
		@Size(max = 150, message = "recipientEmail must not exceed 150 characters") String recipientEmail,
		List<UUID> horseIds) {

	public List<UUID> safeHorseIds() {
		return horseIds == null ? List.of() : horseIds;
	}
}
