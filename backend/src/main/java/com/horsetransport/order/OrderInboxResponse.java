package com.horsetransport.order;

import java.time.LocalDateTime;
import java.util.UUID;

public record OrderInboxResponse(
		UUID id,
		String orderCode,
		OrderStatus status,
		String originAddress,
		String originCountry,
		String destinationAddress,
		String destinationCountry,
		TransportMode transportMode,
		LocalDateTime requestedDepartureAt,
		int horseCount,
		LocalDateTime createdAt) {

	static OrderInboxResponse from(TransportOrder order) {
		return new OrderInboxResponse(order.getId(), order.getOrderCode(), order.getStatus(),
				order.getOriginAddress(), order.getOriginCountry(), order.getDestinationAddress(),
				order.getDestinationCountry(), order.getTransportMode(), order.getRequestedDepartureAt(),
				order.getHorses().size(), order.getCreatedAt());
	}
}
