package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.UUID;

public record AirExecutionResponse(UUID id, UUID routeLegId, UUID escortId,
		ExecutionStatus status, LocalDateTime startedAt, LocalDateTime destinationArrivedAt,
		LocalDateTime completedAt) {

	public static AirExecutionResponse from(AirLegExecution execution) {
		return new AirExecutionResponse(execution.getId(), execution.getRouteLegId(),
				execution.getEscortId(), execution.getStatus(), execution.getStartedAt(),
				execution.getDestinationArrivedAt(), execution.getCompletedAt());
	}
}
