package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.UUID;

import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportMode;
import com.horsetransport.order.TransportOrder;

public record FrcPlanningQueueItemResponse(
		UUID orderId,
		String orderCode,
		OrderStatus orderStatus,
		String originAddress,
		String originCountry,
		String destinationAddress,
		String destinationCountry,
		LocalDateTime requestedDepartureAt,
		TransportMode transportMode,
		int horseCount,
		UUID routePlanId,
		RoutePlanStatus routePlanStatus,
		boolean routePlanEditable) {

	public static FrcPlanningQueueItemResponse from(TransportOrder order, RoutePlan routePlan) {
		return new FrcPlanningQueueItemResponse(
				order.getId(),
				order.getOrderCode(),
				order.getStatus(),
				order.getOriginAddress(),
				order.getOriginCountry(),
				order.getDestinationAddress(),
				order.getDestinationCountry(),
				order.getRequestedDepartureAt(),
				order.getTransportMode(),
				order.getHorses().size(),
				routePlan == null ? null : routePlan.getId(),
				routePlan == null ? null : routePlan.getStatus(),
				routePlan == null || routePlan.isEditableByFrc());
	}
}
