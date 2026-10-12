package com.horsetransport.route;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public record RoadVehicleAllocationRequest(
		@NotEmpty List<@Valid VehicleHorseAllocationRequest> vehicles) {

	public record VehicleHorseAllocationRequest(
			@NotNull UUID vehicleId,
			@NotEmpty List<@NotNull UUID> orderHorseIds) {
	}
}
