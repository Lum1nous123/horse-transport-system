package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record RoadAllocationDetailResponse(
		UUID routeLegId,
		List<RoadVehicleAllocationResponse> vehicles) {

	public record RoadVehicleAllocationResponse(
			UUID roadLegVehicleId,
			UUID vehicleId,
			String plateNumber,
			String vehicleName,
			String vehicleType,
			Integer horseCapacity,
			VehicleStatus status,
			List<UUID> orderHorseIds,
			LocalDateTime assignedAt) {
	}
}