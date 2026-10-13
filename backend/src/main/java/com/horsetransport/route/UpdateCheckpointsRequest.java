package com.horsetransport.route;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record UpdateCheckpointsRequest(
		@NotNull List<@Valid CheckpointItemRequest> checkpoints) {

	public record CheckpointItemRequest(
			@NotNull Integer sequenceNo,
			@NotNull String name,
			@NotNull CheckpointType checkpointType,
			String countryCode,
			Integer minimumRequiredStopMinutes,
			Integer plannedStopDurationMinutes,
			String notes) {
	}
}
