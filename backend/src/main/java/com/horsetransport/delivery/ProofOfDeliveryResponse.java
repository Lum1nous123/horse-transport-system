package com.horsetransport.delivery;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.horsetransport.order.OrderStatus;
import com.horsetransport.route.RouteLegStatus;

public record ProofOfDeliveryResponse(
		UUID id,
		UUID roadVehicleExecutionId,
		UUID airLegExecutionId,
		UUID routeLegId,
		List<UUID> transportedOrderHorseIds,
		String recipientName,
		String proofPhotoUrl,
		String handoverNote,
		UUID confirmedByEscortId,
		LocalDateTime deliveredAt,
		LocalDateTime createdAt,
		int completedHandovers,
		int requiredHandovers,
		RouteLegStatus routeLegStatus,
		OrderStatus orderStatus) {
}
