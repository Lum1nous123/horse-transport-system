package com.horsetransport.order;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record OrderResponse(
		UUID id,
		String orderCode,
		String originAddress,
		String originCountry,
		String destinationAddress,
		String destinationCountry,
		LocalDateTime requestedDepartureAt,
		TransportMode transportMode,
		String specialRequirements,
		String recipientName,
		String recipientPhone,
		String recipientEmail,
		List<UUID> horseIds,
		OrderStatus status,
		LocalDateTime createdAt,
		LocalDateTime updatedAt) {

	static OrderResponse from(TransportOrder order) {
		return new OrderResponse(
				order.getId(), order.getOrderCode(), order.getOriginAddress(), order.getOriginCountry(),
				order.getDestinationAddress(), order.getDestinationCountry(), order.getRequestedDepartureAt(),
				order.getTransportMode(), order.getSpecialRequirements(), order.getRecipientName(),
				order.getRecipientPhone(), order.getRecipientEmail(),
				order.getHorses().stream().map(TransportOrderHorse::getHorseId).toList(),
				order.getStatus(), order.getCreatedAt(), order.getUpdatedAt());
	}
}
