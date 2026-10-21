package com.horsetransport.config;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class DemoStaffSeedSafetyTest {

	@Test
	void safetyOverridesHaveHigherPrecedenceThanApplicationAndProfileProperties() {
		MockEnvironment environment = new MockEnvironment()
				.withProperty("spring.flyway.enabled", "true")
				.withProperty("spring.jpa.hibernate.ddl-auto", "create-drop")
				.withProperty("spring.sql.init.mode", "always")
				.withProperty("spring.main.web-application-type", "servlet");

		DemoStaffSeedSafety.installSafetyOverrides(environment);

		assertThat(environment.getProperty("spring.flyway.enabled")).isEqualTo("false");
		assertThat(environment.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
		assertThat(environment.getProperty("spring.sql.init.mode")).isEqualTo("never");
		assertThat(environment.getProperty("spring.main.web-application-type")).isEqualTo("none");
		assertThat(environment.getProperty("spring.devtools.restart.enabled")).isEqualTo("false");
	}

	@Test
	void acceptsOnlyTheDedicatedProfileAndApprovedResolvedDatasource() {
		MockEnvironment environment = validResolvedEnvironment();

		assertThatCode(() -> DemoStaffSeedSafety.validateResolvedEnvironment(environment))
				.doesNotThrowAnyException();

		environment.setActiveProfiles(DemoStaffSeedSafety.PROFILE, "local");
		assertThatThrownBy(() -> DemoStaffSeedSafety.validateResolvedEnvironment(environment))
				.isInstanceOf(DemoStaffSeedSafetyException.class)
				.hasMessageContaining("Active profiles");
	}

	@Test
	void rejectsDatasourceFlywayJpaAndProfileOverridesBeforeSpringStarts() {
		for (String forbidden : new String[] {
				"SPRING_DATASOURCE_URL", "SPRING_FLYWAY_ENABLED", "SPRING_JPA_HIBERNATE_DDL_AUTO",
				"SPRING_PROFILES_ACTIVE", "DATABASE_URL", "PGHOST"}) {
			Map<String, String> environment = validProcessEnvironment();
			environment.put(forbidden, "unexpected");

			assertThatThrownBy(() -> DemoStaffSeedSafety.validateLaunchInputs(
					environment, new Properties(), new String[0]))
						.isInstanceOf(DemoStaffSeedSafetyException.class)
						.hasMessageContaining(forbidden);
		}
	}

	@Test
	void rejectsSystemPropertiesAndUnknownCommandArguments() {
		Properties properties = new Properties();
		properties.setProperty("spring.datasource.url", "jdbc:postgresql://wrong/db");

		assertThatThrownBy(() -> DemoStaffSeedSafety.validateLaunchInputs(
				validProcessEnvironment(), properties, new String[0]))
				.isInstanceOf(DemoStaffSeedSafetyException.class)
				.hasMessageContaining("spring.datasource.url");

		assertThatThrownBy(() -> DemoStaffSeedSafety.validateLaunchInputs(
				validProcessEnvironment(), new Properties(), new String[] {"--spring.flyway.enabled=false"}))
				.isInstanceOf(DemoStaffSeedSafetyException.class)
				.hasMessageContaining("Unsupported command argument");

		assertThatCode(() -> DemoStaffSeedSafety.validateLaunchInputs(
				validProcessEnvironment(), new Properties(),
				new String[] {"--" + DemoStaffSeedSafety.CONFIRMATION_OPTION}))
				.doesNotThrowAnyException();
	}

	@Test
	void failsClosedWhenApprovedTargetOrResolvedTargetDoesNotMatch() {
		Map<String, String> processEnvironment = validProcessEnvironment();
		processEnvironment.put(DemoStaffSeedSafety.EXPECTED_HOST_PROPERTY, "different.example.test");
		MockEnvironment approvedMismatch = validResolvedEnvironment();
		approvedMismatch.setProperty(DemoStaffSeedSafety.EXPECTED_HOST_PROPERTY, "different.example.test");

		assertThatThrownBy(() -> DemoStaffSeedSafety.approvedTarget(approvedMismatch))
				.isInstanceOf(DemoStaffSeedSafetyException.class)
				.hasMessageContaining("explicitly approved");

		MockEnvironment resolvedMismatch = validResolvedEnvironment();
		resolvedMismatch.setProperty("spring.datasource.url", "jdbc:postgresql://wrong.example.test:5432/approved_db");
		assertThatThrownBy(() -> DemoStaffSeedSafety.validateResolvedEnvironment(resolvedMismatch))
				.isInstanceOf(DemoStaffSeedSafetyException.class)
				.hasMessageContaining("Resolved datasource");
	}

	private Map<String, String> validProcessEnvironment() {
		Map<String, String> environment = new HashMap<>();
		environment.put("DB_HOST", "approved.example.test");
		environment.put("DB_PORT", "5432");
		environment.put("DB_NAME", "approved_db");
		environment.put("DB_USERNAME", "approved_user");
		environment.put("DB_PASSWORD", "generated-credential");
		environment.put(DemoStaffSeedSafety.EXPECTED_HOST_PROPERTY, "approved.example.test");
		environment.put(DemoStaffSeedSafety.EXPECTED_DATABASE_PROPERTY, "approved_db");
		environment.put(DemoStaffSeedSafety.EXPECTED_SCHEMA_PROPERTY, "public");
		return environment;
	}

	private MockEnvironment validResolvedEnvironment() {
		MockEnvironment environment = new MockEnvironment()
				.withProperty("DB_HOST", "approved.example.test")
				.withProperty("DB_NAME", "approved_db")
				.withProperty("DB_USERNAME", "approved_user")
				.withProperty("DB_PASSWORD", "generated-credential")
				.withProperty(DemoStaffSeedSafety.EXPECTED_HOST_PROPERTY, "approved.example.test")
				.withProperty(DemoStaffSeedSafety.EXPECTED_DATABASE_PROPERTY, "approved_db")
				.withProperty(DemoStaffSeedSafety.EXPECTED_SCHEMA_PROPERTY, "public")
				.withProperty("spring.datasource.url",
						"jdbc:postgresql://approved.example.test:5432/approved_db?sslmode=require")
				.withProperty("spring.datasource.username", "approved_user")
				.withProperty("spring.datasource.password", "generated-credential")
				.withProperty("spring.flyway.enabled", "true")
				.withProperty("spring.jpa.hibernate.ddl-auto", "validate")
				.withProperty("spring.jpa.open-in-view", "false")
				.withProperty("spring.main.web-application-type", "servlet");
		environment.setActiveProfiles(DemoStaffSeedSafety.PROFILE);
		return environment;
	}
}
