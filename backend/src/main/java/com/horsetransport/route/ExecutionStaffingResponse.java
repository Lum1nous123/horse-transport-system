package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record ExecutionStaffingResponse(
		List<RoadVehicleExecutionResponse> roadVehicleExecutions,
		List<AirLegExecutionResponse> airLegExecutions) {

	public static ExecutionStaffingResponse empty() {
		return new ExecutionStaffingResponse(List.of(), List.of());
	}

	public record RoadVehicleExecutionResponse(
			UUID id,
			UUID roadLegVehicleId,
			UUID routeLegId,
			UUID driverId,
			UUID escortId,
			ExecutionStatus status,
			LocalDateTime assignedAt) {

		public static RoadVehicleExecutionResponse from(RoadVehicleExecution execution,
				RoadLegVehicle roadVehicle) {
			return new RoadVehicleExecutionResponse(
					execution.getId(),
					execution.getRoadLegVehicleId(),
					roadVehicle.getRouteLegId(),
					execution.getDriverId(),
					execution.getEscortId(),
					execution.getStatus(),
					execution.getAssignedAt());
		}
	}

	public record AirLegExecutionResponse(
			UUID id,
			UUID routeLegId,
			UUID escortId,
			ExecutionStatus status,
			LocalDateTime assignedAt) {

		public static AirLegExecutionResponse from(AirLegExecution execution) {
			return new AirLegExecutionResponse(
					execution.getId(),
					execution.getRouteLegId(),
					execution.getEscortId(),
					execution.getStatus(),
					execution.getAssignedAt());
		}
	}
}
