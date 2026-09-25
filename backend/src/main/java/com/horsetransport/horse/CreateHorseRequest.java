package com.horsetransport.horse;

import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateHorseRequest(
		@NotBlank(message = "name is required")
		@Size(max = 120, message = "name must not exceed 120 characters")
		String name,

		@Size(max = 100, message = "passportNumber must not exceed 100 characters")
		String passportNumber,

		@NotBlank(message = "microchipId is required")
		@Size(max = 50, message = "microchipId must not exceed 50 characters")
		String microchipId,

		@Size(max = 100, message = "breed must not exceed 100 characters")
		String breed,

		@Size(max = 20, message = "sex must not exceed 20 characters")
		String sex,

		LocalDate dateOfBirth,

		String notes) {
}
