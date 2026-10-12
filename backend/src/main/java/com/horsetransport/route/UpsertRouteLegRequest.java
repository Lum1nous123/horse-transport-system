package com.horsetransport.route;

import java.time.LocalDateTime;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record UpsertRouteLegRequest(
		@NotNull @Positive Integer sequenceNo,
		@NotNull RouteLegType legType,
		@NotBlank String origin,
		@NotBlank String destination,
		@NotNull LocalDateTime plannedDepartureAt,
		@NotNull LocalDateTime plannedArrivalAt,
		String airProviderName,
		String airReference,
		Integer airCapacityHorses,
		String equipmentDetails,
		String notes) {
}
