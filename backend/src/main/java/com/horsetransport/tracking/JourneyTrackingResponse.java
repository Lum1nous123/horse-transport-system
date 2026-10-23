package com.horsetransport.tracking;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.horsetransport.order.OrderStatus;
import com.horsetransport.route.CheckpointType;
import com.horsetransport.route.ExecutionStatus;
import com.horsetransport.route.RouteLegStatus;
import com.horsetransport.route.RouteLegType;
import com.horsetransport.route.RoutePlanStatus;
import com.horsetransport.route.WelfareEventType;

public record JourneyTrackingResponse(
		UUID orderId,
		String orderCode,
		OrderStatus orderStatus,
		String originAddress,
		String originCountry,
		String destinationAddress,
		String destinationCountry,
		LocalDateTime requestedDepartureAt,
		LocalDateTime deliveredAt,
		UUID routePlanId,
		RoutePlanStatus routePlanStatus,
		LocalDateTime routePlanApprovedAt,
		List<Leg> legs) {

	public record Leg(
			UUID routeLegId,
			Integer sequenceNo,
			RouteLegType type,
			RouteLegStatus status,
			String origin,
			String destination,
			LocalDateTime plannedDepartureAt,
			LocalDateTime plannedArrivalAt,
			LocalDateTime startedAt,
			LocalDateTime completedAt,
			String airProviderName,
			String airReference,
			List<RoadVehicle> roadVehicles,
			AirExecution airExecution) {
	}

	public record RoadVehicle(
			UUID roadLegVehicleId,
			UUID vehicleId,
			String plateNumber,
			String vehicleName,
			String vehicleType,
			Integer horseCapacity,
			UUID executionId,
			ExecutionStatus executionStatus,
			LocalDateTime startedAt,
			LocalDateTime destinationArrivedAt,
			LocalDateTime completedAt,
			StaffContact driver,
			StaffContact escort,
			List<Horse> horses,
			List<Checkpoint> checkpoints,
			Welfare finalWelfare,
			ProofOfDelivery proofOfDelivery) {
	}

	public record AirExecution(
			UUID executionId,
			ExecutionStatus status,
			LocalDateTime startedAt,
			LocalDateTime destinationArrivedAt,
			LocalDateTime completedAt,
			StaffContact escort,
			Welfare finalWelfare,
			ProofOfDelivery proofOfDelivery) {
	}

	public record StaffContact(String fullName, String phone) {
	}

	public record Horse(UUID transportOrderHorseId, UUID horseId, String name) {
	}

	public record Checkpoint(
			UUID checkpointId,
			Integer sequenceNo,
			String name,
			CheckpointType type,
			String countryCode,
			Integer minimumRequiredStopMinutes,
			Integer plannedStopDurationMinutes,
			String planningNote,
			boolean reached,
			LocalDateTime arrivedAt,
			Welfare welfare) {
	}

	public record Welfare(
			UUID id,
			WelfareEventType eventType,
			String photoUrl,
			String note,
			LocalDateTime recordedAt) {
	}

	public record ProofOfDelivery(
			UUID id,
			String recipientName,
			String proofPhotoUrl,
			String handoverNote,
			LocalDateTime deliveredAt) {
	}
}
