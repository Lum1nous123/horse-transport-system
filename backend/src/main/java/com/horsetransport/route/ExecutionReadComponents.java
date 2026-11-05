package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.horsetransport.delivery.ProofOfDeliveryResponse;
import com.horsetransport.order.OrderStatus;

public final class ExecutionReadComponents {

	private ExecutionReadComponents() {
	}

	public record Staff(UUID id, String fullName) { }

	public record Horse(UUID id, UUID transportOrderHorseId, String name, String microchipId) { }

	public record HandoverProgress(int completedHandovers, int requiredHandovers,
			RouteLegStatus routeLegStatus, OrderStatus orderStatus) { }

	public record RoadCheckpoint(UUID id, Integer sequenceNo, String name, CheckpointType checkpointType,
			LocalDateTime arrivedAt, WelfareEvidenceResponse welfareEvidence) { }

	public record RoadActions(boolean start, UUID nextCheckpointId, boolean arriveAtDestination,
			List<UUID> checkpointWelfareIds, boolean finalWelfare, boolean proofOfDelivery) { }

	public record AirActions(boolean start, boolean arriveAtDestination,
			boolean recordWelfare, boolean complete) { }

	public record Proof(ProofOfDeliveryResponse value) { }
}
