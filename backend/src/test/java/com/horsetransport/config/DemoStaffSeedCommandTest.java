package com.horsetransport.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;

import java.util.Arrays;

import com.horsetransport.BackendApplication;
import com.horsetransport.config.DemoStaffDatabasePreflight.DatabaseIdentity;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.task.TaskSchedulingAutoConfiguration;
import org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration;
import org.springframework.boot.jdbc.autoconfigure.DataSourceInitializationAutoConfiguration;
import org.springframework.boot.security.autoconfigure.SecurityAutoConfiguration;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.boot.persistence.autoconfigure.EntityScan;
import org.springframework.mock.env.MockEnvironment;

class DemoStaffSeedCommandTest {

	@Test
	void structurallyExcludesFlywaySqlInitializationSchedulingAndWebSecurity() {
		EnableAutoConfiguration annotation = DemoStaffSeedCommand.SeedConfiguration.class
				.getAnnotation(EnableAutoConfiguration.class);

		assertThat(Arrays.asList(annotation.exclude())).contains(
				FlywayAutoConfiguration.class,
				DataSourceInitializationAutoConfiguration.class,
				TaskSchedulingAutoConfiguration.class,
				SecurityAutoConfiguration.class,
				UserDetailsServiceAutoConfiguration.class);
		assertThat(DemoStaffSeedCommand.SeedConfiguration.class.getAnnotation(Import.class).value())
				.containsExactly(DemoStaffSeeder.class);
		assertThat(DemoStaffSeedCommand.SeedConfiguration.class.getAnnotation(EntityScan.class)
				.basePackageClasses()).containsExactly(BackendApplication.class);
	}

	@Test
	void withoutConfirmationRunsPreflightButNeverCallsSeeder() throws Exception {
		DemoStaffSeeder seeder = mock(DemoStaffSeeder.class);
		DemoStaffDatabasePreflight preflight = mock(DemoStaffDatabasePreflight.class);
		MockEnvironment environment = approvedEnvironment();
		when(preflight.verify(org.mockito.ArgumentMatchers.any()))
				.thenReturn(new DatabaseIdentity("approved_db", "public", "on"));

		DemoStaffSeedCommand.SeedConfiguration configuration = new DemoStaffSeedCommand.SeedConfiguration();
		configuration.seedDemoStaff(seeder, preflight, environment)
				.run(new DefaultApplicationArguments(new String[0]));

		verify(preflight).verify(org.mockito.ArgumentMatchers.any());
		verify(seeder, never()).seed(org.mockito.ArgumentMatchers.any());
	}

	@Test
	void confirmationRunsSeederOnlyAfterSuccessfulPreflight() throws Exception {
		DemoStaffSeeder seeder = mock(DemoStaffSeeder.class);
		DemoStaffDatabasePreflight preflight = mock(DemoStaffDatabasePreflight.class);
		MockEnvironment environment = approvedEnvironment()
				.withProperty(DemoStaffSeedSafety.PASSWORD_PROPERTY, "generated-password");
		when(preflight.verify(org.mockito.ArgumentMatchers.any()))
				.thenReturn(new DatabaseIdentity("approved_db", "public", "on"));
		when(seeder.seed("generated-password"))
				.thenReturn(new DemoStaffSeeder.DemoStaffSeedResult(8, 0));

		DemoStaffSeedCommand.SeedConfiguration configuration = new DemoStaffSeedCommand.SeedConfiguration();
		configuration.seedDemoStaff(seeder, preflight, environment).run(
				new DefaultApplicationArguments("--" + DemoStaffSeedSafety.CONFIRMATION_OPTION));

		verify(preflight).verify(org.mockito.ArgumentMatchers.any());
		verify(seeder).seed("generated-password");
	}

	@Test
	void confirmationNeverCallsSeederWhenPreflightFails() {
		DemoStaffSeeder seeder = mock(DemoStaffSeeder.class);
		DemoStaffDatabasePreflight preflight = mock(DemoStaffDatabasePreflight.class);
		MockEnvironment environment = approvedEnvironment()
				.withProperty(DemoStaffSeedSafety.PASSWORD_PROPERTY, "generated-password");
		doThrow(new DemoStaffSeedSafetyException("target mismatch"))
				.when(preflight).verify(org.mockito.ArgumentMatchers.any());

		DemoStaffSeedCommand.SeedConfiguration configuration = new DemoStaffSeedCommand.SeedConfiguration();

		org.assertj.core.api.Assertions.assertThatThrownBy(() ->
				configuration.seedDemoStaff(seeder, preflight, environment).run(
						new DefaultApplicationArguments("--" + DemoStaffSeedSafety.CONFIRMATION_OPTION)))
				.isInstanceOf(DemoStaffSeedSafetyException.class);
		verify(seeder, never()).seed(org.mockito.ArgumentMatchers.any());
	}

	private MockEnvironment approvedEnvironment() {
		return new MockEnvironment()
				.withProperty("DB_HOST", "approved.example.test")
				.withProperty("DB_NAME", "approved_db")
				.withProperty(DemoStaffSeedSafety.EXPECTED_HOST_PROPERTY, "approved.example.test")
				.withProperty(DemoStaffSeedSafety.EXPECTED_DATABASE_PROPERTY, "approved_db")
				.withProperty(DemoStaffSeedSafety.EXPECTED_SCHEMA_PROPERTY, "public");
	}
}
