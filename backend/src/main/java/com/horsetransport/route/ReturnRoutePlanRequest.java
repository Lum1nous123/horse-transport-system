package com.horsetransport.route;

import jakarta.validation.constraints.NotBlank;

public record ReturnRoutePlanRequest(
		@NotBlank String reason) {
}
