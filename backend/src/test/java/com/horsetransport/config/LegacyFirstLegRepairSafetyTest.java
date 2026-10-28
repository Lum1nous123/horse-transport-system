package com.horsetransport.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.HashMap;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class LegacyFirstLegRepairSafetyTest {
	@Test
	void acceptsOnlyExplicitApprovedTargetAndDedicatedWriteFlag() {
		Map<String, String> environment = processEnvironment();
		assertThatCode(() -> LegacyFirstLegRepairSafety.validateLaunchInputs(environment,
				new Properties(), new String[] {"--" + LegacyFirstLegRepairSafety.CONFIRMATION_OPTION}))
				.doesNotThrowAnyException();

		environment.put(LegacyFirstLegRepairSafety.EXPECTED_HOST, "production.example.test");
		assertThatThrownBy(() -> LegacyFirstLegRepairSafety.validateLaunchInputs(environment,
				new Properties(), new String[0]))
				.isInstanceOf(DemoStaffSeedSafetyException.class)
				.hasMessageContaining("approved target");
	}

	@Test
	void rejectsUnknownArgumentsAndDatasourceOverrides() {
		assertThatThrownBy(() -> LegacyFirstLegRepairSafety.validateLaunchInputs(processEnvironment(),
				new Properties(), new String[] {"--spring.profiles.active=local"}))
				.isInstanceOf(DemoStaffSeedSafetyException.class)
				.hasMessageContaining("Unsupported command argument");

		Map<String, String> datasourceOverride = processEnvironment();
		datasourceOverride.put("SPRING_DATASOURCE_URL", "jdbc:postgresql://wrong/db");
		assertThatThrownBy(() -> LegacyFirstLegRepairSafety.validateLaunchInputs(datasourceOverride,
				new Properties(), new String[0]))
				.isInstanceOf(DemoStaffSeedSafetyException.class)
				.hasMessageContaining("SPRING_DATASOURCE_URL");

		Map<String, String> postgresOverride = processEnvironment();
		postgresOverride.put("PGHOST", "wrong.example.test");
		assertThatThrownBy(() -> LegacyFirstLegRepairSafety.validateLaunchInputs(postgresOverride,
				new Properties(), new String[0]))
				.isInstanceOf(DemoStaffSeedSafetyException.class)
				.hasMessageContaining("PGHOST");
	}

	@Test
	void forcesNonWebNoMigrationValidateOnlyStartupAndExactProfile() {
		MockEnvironment environment = resolvedEnvironment();
		LegacyFirstLegRepairSafety.installSafetyOverrides(environment);
		assertThat(environment.getProperty("spring.flyway.enabled")).isEqualTo("false");
		assertThat(environment.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
		assertThat(environment.getProperty("spring.sql.init.mode")).isEqualTo("never");
		assertThatCode(() -> LegacyFirstLegRepairSafety.validateResolved(environment)).doesNotThrowAnyException();

		environment.setActiveProfiles(LegacyFirstLegRepairSafety.PROFILE, "local");
		assertThatThrownBy(() -> LegacyFirstLegRepairSafety.validateResolved(environment))
				.isInstanceOf(DemoStaffSeedSafetyException.class).hasMessageContaining("profiles");
	}

	@Test
	void reassignmentCommandHasAnIndependentFlagAndExactExecutionAllowlist() {
		assertThatCode(() -> LegacyFirstLegRepairSafety.validateLaunchInputs(processEnvironment(),
				new Properties(), new String[] {"--" + LegacyFirstLegRepairSafety.REASSIGNMENT_CONFIRMATION_OPTION},
				LegacyFirstLegRepairSafety.REASSIGNMENT_CONFIRMATION_OPTION)).doesNotThrowAnyException();
		assertThat(LegacyExecutionReassignmentService.ASSIGNMENTS).hasSize(4);
		assertThat(LegacyExecutionReassignmentService.ASSIGNMENTS.stream()
				.map(LegacyExecutionReassignmentService.Assignment::orderCode).distinct()).hasSize(3);

		var outside = new LegacyExecutionReassignmentService.Assignment("ORD-UNAPPROVED",
				UUID.fromString("11111111-1111-1111-1111-111111111111"),
				"driver1.s3demo@example.com", "escort1.s3demo@example.com");
		assertThatThrownBy(() -> new LegacyExecutionReassignmentService(null).inspect(outside))
				.isInstanceOf(IllegalStateException.class).hasMessageContaining("allowlist");
	}

	private Map<String, String> processEnvironment() {
		Map<String, String> values = new HashMap<>();
		values.put("DB_HOST", "development.example.test"); values.put("DB_NAME", "postgres");
		values.put("DB_USERNAME", "user"); values.put("DB_PASSWORD", "password");
		values.put(LegacyFirstLegRepairSafety.EXPECTED_HOST, "development.example.test");
		values.put(LegacyFirstLegRepairSafety.EXPECTED_DATABASE, "postgres");
		values.put(LegacyFirstLegRepairSafety.EXPECTED_SCHEMA, "public");
		return values;
	}

	private MockEnvironment resolvedEnvironment() {
		MockEnvironment environment = new MockEnvironment()
				.withProperty("DB_HOST", "development.example.test").withProperty("DB_NAME", "postgres")
				.withProperty("DB_USERNAME", "user").withProperty("DB_PASSWORD", "password")
				.withProperty(LegacyFirstLegRepairSafety.EXPECTED_HOST, "development.example.test")
				.withProperty(LegacyFirstLegRepairSafety.EXPECTED_DATABASE, "postgres")
				.withProperty(LegacyFirstLegRepairSafety.EXPECTED_SCHEMA, "public")
				.withProperty("spring.datasource.url", "jdbc:postgresql://development.example.test:5432/postgres")
				.withProperty("spring.datasource.username", "user")
				.withProperty("spring.datasource.password", "password");
		environment.setActiveProfiles(LegacyFirstLegRepairSafety.PROFILE);
		return environment;
	}
}
