package com.horsetransport.tracking;

import java.time.LocalDateTime;
import java.util.UUID;

import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportMode;
import com.horsetransport.order.TransportOrder;

public record LogisticsTrackingOrderResponse(UUID orderId, String orderCode, OrderStatus status,
		String originAddress, String originCountry, String destinationAddress, String destinationCountry,
		TransportMode transportMode, LocalDateTime requestedDepartureAt, int horseCount,
		LocalDateTime createdAt, LocalDateTime deliveredAt) {
	static LogisticsTrackingOrderResponse from(TransportOrder order) {
		return new LogisticsTrackingOrderResponse(order.getId(), order.getOrderCode(), order.getStatus(),
				order.getOriginAddress(), order.getOriginCountry(), order.getDestinationAddress(),
				order.getDestinationCountry(), order.getTransportMode(), order.getRequestedDepartureAt(),
				order.getHorses().size(), order.getCreatedAt(), order.getDeliveredAt());
	}
}
