package com.horsetransport.config;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class RetiredLegacyCommandAbsenceTest {

	@ParameterizedTest
	@ValueSource(strings = {
			"com.horsetransport.config.LegacyFirstLegRepairCommand",
			"com.horsetransport.config.LegacyFirstLegRepairSafety",
			"com.horsetransport.config.LegacyFirstLegRepairService",
			"com.horsetransport.config.LegacyExecutionReassignmentCommand",
			"com.horsetransport.config.LegacyExecutionReassignmentService"
	})
	void retiredLegacyDatabaseMutationTypesAreAbsentFromTheRuntimeClasspath(String className) {
		assertThatThrownBy(() -> Class.forName(className, false, getClass().getClassLoader()))
				.isInstanceOf(ClassNotFoundException.class);
	}
}
