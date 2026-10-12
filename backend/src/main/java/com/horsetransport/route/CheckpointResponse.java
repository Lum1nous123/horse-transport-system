package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.UUID;

public record CheckpointResponse(
		UUID id,
		Integer sequenceNo,
		String name,
		CheckpointType checkpointType,
		String countryCode,
		Integer minimumRequiredStopMinutes,
		Integer plannedStopDurationMinutes,
		String notes,
		LocalDateTime createdAt,
		LocalDateTime updatedAt) {

	public static CheckpointResponse from(Checkpoint checkpoint) {
		return new CheckpointResponse(
				checkpoint.getId(),
				checkpoint.getSequenceNo(),
				checkpoint.getName(),
				checkpoint.getCheckpointType(),
				checkpoint.getCountryCode(),
				checkpoint.getMinimumRequiredStopMinutes(),
				checkpoint.getPlannedStopDurationMinutes(),
				checkpoint.getNotes(),
				checkpoint.getCreatedAt(),
				checkpoint.getUpdatedAt());
	}
}
