package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.UUID;

public record WelfareEvidenceResponse(UUID id, UUID roadVehicleExecutionId, UUID airLegExecutionId,
		UUID checkpointId, WelfareEventType eventType, String photoUrl, String note,
		UUID recordedByEscortId, LocalDateTime recordedAt) {

	public static WelfareEvidenceResponse from(WelfareEvidence evidence) {
		return new WelfareEvidenceResponse(evidence.getId(), evidence.getRoadVehicleExecutionId(),
				evidence.getAirLegExecutionId(), evidence.getCheckpointId(), evidence.getEventType(),
				evidence.getPhotoUrl(), evidence.getNote(), evidence.getRecordedByEscortId(), evidence.getRecordedAt());
	}
}
