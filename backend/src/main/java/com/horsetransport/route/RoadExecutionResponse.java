package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.UUID;

public record RoadExecutionResponse(UUID id, UUID roadLegVehicleId, UUID driverId, UUID escortId,
		ExecutionStatus status, LocalDateTime startedAt, LocalDateTime destinationArrivedAt,
		LocalDateTime completedAt) {

	public static RoadExecutionResponse from(RoadVehicleExecution execution) {
		return new RoadExecutionResponse(execution.getId(), execution.getRoadLegVehicleId(),
				execution.getDriverId(), execution.getEscortId(), execution.getStatus(),
				execution.getStartedAt(), execution.getDestinationArrivedAt(), execution.getCompletedAt());
	}
}
