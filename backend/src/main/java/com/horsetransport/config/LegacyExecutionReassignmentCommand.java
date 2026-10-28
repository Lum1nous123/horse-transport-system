package com.horsetransport.config;

import com.horsetransport.BackendApplication;
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

import javax.sql.DataSource;
import java.util.ArrayList;
import java.util.List;

public final class LegacyExecutionReassignmentCommand {
	private LegacyExecutionReassignmentCommand() { }
	public static void main(String[] args) {
		LegacyFirstLegRepairSafety.validateLaunchInputs(System.getenv(), System.getProperties(), args,
				LegacyFirstLegRepairSafety.REASSIGNMENT_CONFIRMATION_OPTION);
		System.setProperty("spring.devtools.restart.enabled", "false");
		try (ConfigurableApplicationContext ignored = new SpringApplicationBuilder(Config.class)
				.web(WebApplicationType.NONE).profiles(LegacyFirstLegRepairSafety.PROFILE)
				.initializers(context -> {
					LegacyFirstLegRepairSafety.installSafetyOverrides(context.getEnvironment());
					LegacyFirstLegRepairSafety.validateResolved(context.getEnvironment());
				}).properties("spring.main.banner-mode=off").run(args)) { }
	}

	@Configuration(proxyBeanMethods = false)
	@EnableAutoConfiguration(exclude = {FlywayAutoConfiguration.class, DataSourceInitializationAutoConfiguration.class,
			TaskSchedulingAutoConfiguration.class, SecurityAutoConfiguration.class, UserDetailsServiceAutoConfiguration.class})
	@EntityScan(basePackageClasses = BackendApplication.class)
	@EnableJpaRepositories(basePackages = "com.horsetransport")
	@Import(LegacyExecutionReassignmentService.class)
	@Profile(LegacyFirstLegRepairSafety.PROFILE)
	static class Config {
		@Bean DemoStaffDatabasePreflight preflight(DataSource dataSource) { return new DemoStaffDatabasePreflight(dataSource); }
		@Bean ApplicationRunner runner(LegacyExecutionReassignmentService service,
				DemoStaffDatabasePreflight preflight, Environment environment) {
			return (ApplicationArguments args) -> {
				preflight.verify(LegacyFirstLegRepairSafety.target(environment));
				List<LegacyExecutionReassignmentService.Assignment> eligible = new ArrayList<>();
				for (var assignment : LegacyExecutionReassignmentService.ASSIGNMENTS) {
					try {
						var result = service.inspect(assignment); eligible.add(assignment);
						System.out.printf("Reassignment preflight: order=%s leg=%d vehicle=%s from=%s/%s to=%s/%s outcome=%s%n",
								assignment.orderCode(), result.sequenceNo(), result.vehiclePlate(), result.previousDriverEmail(),
								result.previousEscortEmail(), assignment.driverEmail(), assignment.escortEmail(), result.outcome());
					} catch (RuntimeException exception) {
						System.out.printf("Reassignment skipped: order=%s execution=%s reason=%s%n",
								assignment.orderCode(), assignment.executionId(), exception.getMessage());
					}
				}
				if (!LegacyFirstLegRepairSafety.confirmed(args,
						LegacyFirstLegRepairSafety.REASSIGNMENT_CONFIRMATION_OPTION)) {
					System.out.println("Execution reassignment preflight passed; no changes made."); return;
				}
				for (var assignment : eligible) {
					try {
						var result = service.reassign(assignment);
						System.out.printf("Reassignment result: order=%s execution=%s to=%s/%s outcome=%s%n",
								assignment.orderCode(), assignment.executionId(), assignment.driverEmail(),
								assignment.escortEmail(), result.outcome());
					} catch (RuntimeException exception) {
						System.out.printf("Reassignment skipped: order=%s execution=%s reason=%s%n",
								assignment.orderCode(), assignment.executionId(), exception.getMessage());
					}
				}
			};
		}
	}
}
