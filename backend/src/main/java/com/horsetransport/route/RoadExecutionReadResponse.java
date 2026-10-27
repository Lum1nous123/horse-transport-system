package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.horsetransport.delivery.ProofOfDeliveryResponse;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.route.ExecutionReadComponents.HandoverProgress;
import com.horsetransport.route.ExecutionReadComponents.Horse;
import com.horsetransport.route.ExecutionReadComponents.RoadActions;
import com.horsetransport.route.ExecutionReadComponents.RoadCheckpoint;
import com.horsetransport.route.ExecutionReadComponents.Staff;

public final class RoadExecutionReadResponse {

	private RoadExecutionReadResponse() {
	}

	public record Queue(List<Summary> executions) { }

	public record Summary(
			UUID executionId, UUID roadLegVehicleId, UUID routeLegId,
			UUID orderId, String orderCode, OrderStatus orderStatus,
			Integer routeLegSequenceNo, RouteLegStatus routeLegStatus, boolean isFinalLeg,
			String origin, String destination, LocalDateTime plannedDepartureAt,
			String vehiclePlateNumber, String vehicleName, int horseCount,
			ExecutionStatus status, int reachedCheckpointCount, int pendingCheckpointWelfareCount,
			LocalDateTime destinationArrivedAt, boolean finalWelfareRecorded,
			boolean proofOfDeliveryRecorded, boolean proofOfDeliveryAvailable,
			HandoverProgress handoverProgress) { }

	public record Detail(
			UUID executionId, UUID roadLegVehicleId, UUID routeLegId,
			UUID orderId, String orderCode, OrderStatus orderStatus,
			Integer routeLegSequenceNo, RouteLegStatus routeLegStatus, boolean isFinalLeg,
			String origin, String destination, LocalDateTime plannedDepartureAt,
			String vehiclePlateNumber, String vehicleName, int horseCount,
			ExecutionStatus status, int reachedCheckpointCount, int pendingCheckpointWelfareCount,
			LocalDateTime assignedAt, LocalDateTime startedAt, LocalDateTime destinationArrivedAt,
			LocalDateTime completedAt, Staff assignedDriver, Staff assignedEscort,
			List<Horse> horses, List<RoadCheckpoint> checkpoints,
			WelfareEvidenceResponse finalWelfareEvidence, ProofOfDeliveryResponse proofOfDelivery,
			boolean proofOfDeliveryRecorded, boolean proofOfDeliveryAvailable,
			HandoverProgress handoverProgress, RoadActions availableActions,
			LocalDateTime lastUpdatedAt) { }
}
