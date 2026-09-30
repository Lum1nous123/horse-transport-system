package com.horsetransport.order;

import java.time.LocalDateTime;
import java.util.UUID;

public record DocumentInboxResponse(
		UUID id,
		String orderCode,
		OrderStatus status,
		String originAddress,
		String originCountry,
		String destinationAddress,
		String destinationCountry,
		LocalDateTime requestedDepartureAt,
		int horseCount,
		LocalDateTime documentCompletionDeadlineAt,
		LocalDateTime documentDeadlineSetAt,
		LocalDateTime createdAt) {

	static DocumentInboxResponse from(TransportOrder order) {
		return new DocumentInboxResponse(order.getId(), order.getOrderCode(), order.getStatus(),
				order.getOriginAddress(), order.getOriginCountry(), order.getDestinationAddress(),
				order.getDestinationCountry(), order.getRequestedDepartureAt(), order.getHorses().size(),
				order.getDocumentCompletionDeadlineAt(), order.getDocumentDeadlineSetAt(), order.getCreatedAt());
	}
}
