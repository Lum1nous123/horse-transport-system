package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportMode;
import com.horsetransport.order.TransportOrder;

public record FrcPlanningContextResponse(
		UUID orderId,
		String orderCode,
		OrderStatus orderStatus,
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
		List<FrcPlanningHorseResponse> horses,
		RoutePlanSummaryResponse routePlan) {

	public static FrcPlanningContextResponse from(TransportOrder order,
			List<FrcPlanningHorseResponse> horses,
			RoutePlan routePlan) {
		return new FrcPlanningContextResponse(
				order.getId(),
				order.getOrderCode(),
				order.getStatus(),
				order.getOriginAddress(),
				order.getOriginCountry(),
				order.getDestinationAddress(),
				order.getDestinationCountry(),
				order.getRequestedDepartureAt(),
				order.getTransportMode(),
				order.getSpecialRequirements(),
				order.getRecipientName(),
				order.getRecipientPhone(),
				order.getRecipientEmail(),
				horses,
				RoutePlanSummaryResponse.from(routePlan));
	}
}
