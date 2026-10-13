package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
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

	public static RoutePlanResponse from(RoutePlan routePlan, List<RouteLeg> legs,
			Map<UUID, List<Checkpoint>> checkpointsByLegId) {
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
						.map(leg -> RouteLegResponse.from(
								leg,
								checkpointsByLegId.getOrDefault(leg.getId(), List.of())))
						.toList());
	}
}