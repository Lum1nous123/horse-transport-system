package com.horsetransport.route;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface WelfareEvidenceRepository extends JpaRepository<WelfareEvidence, UUID> {
	List<WelfareEvidence> findAllByRoadVehicleExecutionIdOrderByRecordedAtAsc(UUID roadVehicleExecutionId);

	Optional<WelfareEvidence> findByRoadVehicleExecutionIdAndCheckpointIdAndEventType(
			UUID roadVehicleExecutionId, UUID checkpointId, WelfareEventType eventType);

	Optional<WelfareEvidence> findByRoadVehicleExecutionIdAndEventType(
			UUID roadVehicleExecutionId, WelfareEventType eventType);

	Optional<WelfareEvidence> findByAirLegExecutionIdAndEventType(UUID airLegExecutionId,
			WelfareEventType eventType);
}
