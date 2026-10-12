package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record RoutePlanResponse(
		UUID id,
		UUID transportOrderId,
		RoutePlanStatus status,
		UUID createdBy,
		LocalDateTime createdAt,
		LocalDateTime updatedAt,
		LocalDateTime lockedAt,
		LocalDateTime approvedAt,
		List<RouteLegResponse> legs) {

	public static RoutePlanResponse from(RoutePlan routePlan, List<RouteLeg> legs) {
		return new RoutePlanResponse(
				routePlan.getId(),
				routePlan.getTransportOrderId(),
				routePlan.getStatus(),
				routePlan.getCreatedBy(),
				routePlan.getCreatedAt(),
				routePlan.getUpdatedAt(),
				routePlan.getLockedAt(),
				routePlan.getApprovedAt(),
				legs.stream()
						.map(RouteLegResponse::from)
						.toList());
	}
}
