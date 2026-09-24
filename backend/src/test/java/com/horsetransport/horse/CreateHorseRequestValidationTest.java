package com.horsetransport.horse;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class CreateHorseRequestValidationTest {

	private static Validator validator;

	@BeforeAll
	static void createValidator() {
		validator = Validation.buildDefaultValidatorFactory().getValidator();
	}

	@Test
	void acceptsRequiredFieldsWithNullOptionalFields() {
		CreateHorseRequest request = new CreateHorseRequest(
				"Thunder", null, "985141000123456", null, null, null, null);

		assertThat(validator.validate(request)).isEmpty();
	}

	@Test
	void requiresNameAndMicrochipId() {
		CreateHorseRequest request = new CreateHorseRequest(" ", null, " ", null, null, null, null);

		assertThat(propertyNames(validator.validate(request)))
				.containsExactlyInAnyOrder("name", "microchipId");
	}

	@Test
	void enforcesErdStringLengths() {
		CreateHorseRequest request = new CreateHorseRequest(
				"n".repeat(121),
				"p".repeat(101),
				"m".repeat(51),
				"b".repeat(101),
				"s".repeat(21),
				null,
				null);

		assertThat(propertyNames(validator.validate(request)))
				.containsExactlyInAnyOrder("name", "passportNumber", "microchipId", "breed", "sex");
	}

	private Set<String> propertyNames(Set<ConstraintViolation<CreateHorseRequest>> violations) {
		return violations.stream()
				.map(violation -> violation.getPropertyPath().toString())
				.collect(java.util.stream.Collectors.toSet());
	}

}
