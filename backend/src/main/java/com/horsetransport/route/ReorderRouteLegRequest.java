package com.horsetransport.route;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record ReorderRouteLegRequest(
		@NotEmpty List<@Valid RouteLegSequenceRequest> legs) {

	public record RouteLegSequenceRequest(
			@NotNull UUID legId,
			@NotNull @Positive Integer sequenceNo) {
	}
}
