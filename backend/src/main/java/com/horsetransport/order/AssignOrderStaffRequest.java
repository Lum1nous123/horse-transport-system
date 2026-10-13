package com.horsetransport.order;

import java.util.UUID;

import jakarta.validation.constraints.NotNull;

public record AssignOrderStaffRequest(
		@NotNull UUID transportSpecialistId,
		@NotNull UUID fleetRouteCoordinatorId) {
}
