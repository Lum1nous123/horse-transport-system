package com.horsetransport.config;

import com.horsetransport.BackendApplication;
import com.horsetransport.user.UserRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.task.TaskSchedulingAutoConfiguration;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration;
import org.springframework.boot.jdbc.autoconfigure.DataSourceInitializationAutoConfiguration;
import org.springframework.boot.persistence.autoconfigure.EntityScan;
import org.springframework.boot.security.autoconfigure.SecurityAutoConfiguration;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import javax.sql.DataSource;

public final class DemoStaffSeedCommand {

	private DemoStaffSeedCommand() {
	}

	public static void main(String[] args) {
		DemoStaffSeedSafety.validateLaunchInputs(System.getenv(), System.getProperties(), args);
		DemoStaffSeedSafety.disableDevToolsRestart();
		try (ConfigurableApplicationContext ignored = new SpringApplicationBuilder(SeedConfiguration.class)
				.web(WebApplicationType.NONE)
				.profiles("demo-staff-command")
				.initializers(context -> {
					DemoStaffSeedSafety.installSafetyOverrides(context.getEnvironment());
					DemoStaffSeedSafety.validateResolvedEnvironment(context.getEnvironment());
				})
				.properties(
						"spring.main.banner-mode=off")
				.run(args)) {
			// ApplicationRunner completes before run returns; closing exits without starting web or schedulers.
		}
	}

	@Configuration(proxyBeanMethods = false)
	@EnableAutoConfiguration(exclude = {
			FlywayAutoConfiguration.class,
			DataSourceInitializationAutoConfiguration.class,
			TaskSchedulingAutoConfiguration.class,
			SecurityAutoConfiguration.class,
			UserDetailsServiceAutoConfiguration.class
	})
	// Register the same entity model as the application so repository JPQL is validated,
	// without enabling the application's component scan, schedulers, or data seeders.
	@EntityScan(basePackageClasses = BackendApplication.class)
	@EnableJpaRepositories(basePackageClasses = UserRepository.class)
	@Import(DemoStaffSeeder.class)
	@Profile("demo-staff-command")
	static class SeedConfiguration {

		@Bean
		PasswordEncoder passwordEncoder() {
			return new BCryptPasswordEncoder();
		}

		@Bean
		DemoStaffDatabasePreflight demoStaffDatabasePreflight(DataSource dataSource) {
			return new DemoStaffDatabasePreflight(dataSource);
		}

		@Bean
		ApplicationRunner seedDemoStaff(DemoStaffSeeder seeder, DemoStaffDatabasePreflight preflight,
				Environment environment) {
			return new ApplicationRunner() {
				@Override
				public void run(ApplicationArguments arguments) {
					DemoStaffSeedSafety.ApprovedDatabaseTarget approved =
							DemoStaffSeedSafety.approvedTarget(environment);
					preflight.verify(approved);
					if (!DemoStaffSeedSafety.writeConfirmed(arguments)) {
						System.out.println("Demo staff preflight passed; no database changes were made.");
						return;
					}
					DemoStaffSeeder.DemoStaffSeedResult result = seeder.seed(
							environment.getProperty(DemoStaffSeedSafety.PASSWORD_PROPERTY));
					System.out.printf("Demo staff seed complete: created=%d, existing=%d%n",
							result.created(), result.existing());
				}
			};
		}
	}
}
