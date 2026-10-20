package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.UUID;

public record CheckpointArrivalResponse(UUID id, UUID executionId, UUID checkpointId,
		UUID recordedByDriverId, LocalDateTime arrivedAt) {

	public static CheckpointArrivalResponse from(VehicleCheckpointArrival arrival) {
		return new CheckpointArrivalResponse(arrival.getId(), arrival.getRoadVehicleExecutionId(),
				arrival.getCheckpointId(), arrival.getRecordedByDriverId(), arrival.getArrivedAt());
	}
}
