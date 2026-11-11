package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.horsetransport.user.UserAccount;

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
			String driverFullName,
			String driverEmail,
			UUID escortId,
			String escortFullName,
			String escortEmail,
			ExecutionStatus status,
			LocalDateTime assignedAt) {

		public static RoadVehicleExecutionResponse from(RoadVehicleExecution execution,
				RoadLegVehicle roadVehicle, UserAccount driver, UserAccount escort) {
			return new RoadVehicleExecutionResponse(
					execution.getId(),
					execution.getRoadLegVehicleId(),
					roadVehicle.getRouteLegId(),
					execution.getDriverId(),
					driver == null ? null : driver.getFullName(),
					driver == null ? null : driver.getEmail(),
					execution.getEscortId(),
					escort == null ? null : escort.getFullName(),
					escort == null ? null : escort.getEmail(),
					execution.getStatus(),
					execution.getAssignedAt());
		}
	}

	public record AirLegExecutionResponse(
			UUID id,
			UUID routeLegId,
			UUID escortId,
			String escortFullName,
			String escortEmail,
			ExecutionStatus status,
			LocalDateTime assignedAt) {

		public static AirLegExecutionResponse from(AirLegExecution execution,
				UserAccount escort) {
			return new AirLegExecutionResponse(
					execution.getId(),
					execution.getRouteLegId(),
					execution.getEscortId(),
					escort == null ? null : escort.getFullName(),
					escort == null ? null : escort.getEmail(),
					execution.getStatus(),
					execution.getAssignedAt());
		}
	}
}
