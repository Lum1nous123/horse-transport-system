package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.UUID;

public record RouteLegResponse(
		UUID id,
		Integer sequenceNo,
		RouteLegType legType,
		String origin,
		String destination,
		LocalDateTime plannedDepartureAt,
		LocalDateTime plannedArrivalAt,
		String airProviderName,
		String airReference,
		Integer airCapacityHorses,
		String equipmentDetails,
		RouteLegStatus status,
		String notes,
		LocalDateTime startedAt,
		LocalDateTime completedAt,
		LocalDateTime createdAt,
		LocalDateTime updatedAt) {

	public static RouteLegResponse from(RouteLeg leg) {
		return new RouteLegResponse(
				leg.getId(),
				leg.getSequenceNo(),
				leg.getLegType(),
				leg.getOrigin(),
				leg.getDestination(),
				leg.getPlannedDepartureAt(),
				leg.getPlannedArrivalAt(),
				leg.getAirProviderName(),
				leg.getAirReference(),
				leg.getAirCapacityHorses(),
				leg.getEquipmentDetails(),
				leg.getStatus(),
				leg.getNotes(),
				leg.getStartedAt(),
				leg.getCompletedAt(),
				leg.getCreatedAt(),
				leg.getUpdatedAt());
	}
}
