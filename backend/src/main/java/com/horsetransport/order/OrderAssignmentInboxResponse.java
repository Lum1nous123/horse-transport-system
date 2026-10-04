package com.horsetransport.order;

import java.time.LocalDateTime;
import java.util.UUID;

public record OrderAssignmentInboxResponse(
		UUID id,
		String orderCode,
		OrderStatus status,
		String originAddress,
		String originCountry,
		String destinationAddress,
		String destinationCountry,
		LocalDateTime approvedAt,
		int horseCount) {

	static OrderAssignmentInboxResponse from(TransportOrder order) {
		return new OrderAssignmentInboxResponse(order.getId(), order.getOrderCode(), order.getStatus(),
				order.getOriginAddress(), order.getOriginCountry(), order.getDestinationAddress(),
				order.getDestinationCountry(), order.getApprovedAt(), order.getHorses().size());
	}
}
