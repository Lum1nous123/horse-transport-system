package com.horsetransport.route;

import java.util.List;
import java.util.UUID;

public record VehicleCandidateResponse(
		UUID vehicleId,
		String plateNumber,
		String vehicleName,
		String vehicleType,
		Integer horseCapacity,
		VehicleStatus status,
		boolean selectable,
		List<String> reasons) {

	public static VehicleCandidateResponse from(Vehicle vehicle, List<String> reasons) {
		return new VehicleCandidateResponse(
				vehicle.getId(),
				vehicle.getPlateNumber(),
				vehicle.getVehicleName(),
				vehicle.getVehicleType(),
				vehicle.getHorseCapacity(),
				vehicle.getStatus(),
				reasons.isEmpty(),
				List.copyOf(reasons));
	}
}