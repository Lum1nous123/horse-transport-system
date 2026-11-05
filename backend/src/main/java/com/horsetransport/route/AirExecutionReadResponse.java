package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.horsetransport.delivery.ProofOfDeliveryResponse;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.route.ExecutionReadComponents.AirActions;
import com.horsetransport.route.ExecutionReadComponents.HandoverProgress;
import com.horsetransport.route.ExecutionReadComponents.Horse;
import com.horsetransport.route.ExecutionReadComponents.Staff;

public final class AirExecutionReadResponse {

	private AirExecutionReadResponse() {
	}

	public record Queue(List<Summary> executions) { }

	public record Summary(
			UUID executionId, UUID routeLegId, UUID orderId, String orderCode, OrderStatus orderStatus,
			Integer routeLegSequenceNo, RouteLegStatus routeLegStatus, boolean isFinalLeg,
			String origin, String destination, LocalDateTime plannedDepartureAt,
			LocalDateTime plannedArrivalAt, ExecutionStatus status, boolean welfareRecorded,
			boolean proofOfDeliveryRecorded, boolean proofOfDeliveryAvailable,
			HandoverProgress handoverProgress, AirActions availableActions) { }

	public record Detail(
			UUID executionId, UUID routeLegId, UUID orderId, String orderCode, OrderStatus orderStatus,
			Integer routeLegSequenceNo, RouteLegStatus routeLegStatus, boolean isFinalLeg,
			String origin, String destination, LocalDateTime plannedDepartureAt,
			LocalDateTime plannedArrivalAt, ExecutionStatus status,
			LocalDateTime assignedAt, LocalDateTime startedAt, LocalDateTime destinationArrivedAt,
			LocalDateTime completedAt, Staff assignedEscort, List<Horse> horses,
			WelfareEvidenceResponse welfareEvidence, ProofOfDeliveryResponse proofOfDelivery,
			boolean proofOfDeliveryRecorded, boolean proofOfDeliveryAvailable,
			HandoverProgress handoverProgress, AirActions availableActions,
			LocalDateTime lastUpdatedAt) { }
}
