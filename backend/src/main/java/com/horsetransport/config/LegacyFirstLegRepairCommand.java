package com.horsetransport.config;

import com.horsetransport.BackendApplication;
import com.horsetransport.audit.StatusAuditRecorder;
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

public final class LegacyFirstLegRepairCommand {
	private LegacyFirstLegRepairCommand() { }
	public static void main(String[] args) {
		LegacyFirstLegRepairSafety.validateLaunchInputs(System.getenv(), System.getProperties(), args);
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
	@Import({LegacyFirstLegRepairService.class, StatusAuditRecorder.class})
	@Profile(LegacyFirstLegRepairSafety.PROFILE)
	static class Config {
		@Bean DemoStaffDatabasePreflight preflight(DataSource dataSource) { return new DemoStaffDatabasePreflight(dataSource); }
		@Bean ApplicationRunner runner(LegacyFirstLegRepairService repair, DemoStaffDatabasePreflight preflight,
				Environment environment) {
			return (ApplicationArguments args) -> {
				preflight.verify(LegacyFirstLegRepairSafety.target(environment));
				List<String> validated = new ArrayList<>();
				for (String code : LegacyFirstLegRepairService.APPROVED_ORDERS) {
					try {
						var result = repair.inspect(code);
						validated.add(code);
						System.out.printf("Legacy repair preflight: order=%s state=%s outcome=%s%n",
								code, result.firstLegStatus(), result.outcome());
					} catch (RuntimeException exception) {
						System.out.printf("Legacy repair preflight skipped: order=%s reason=%s%n",
								code, exception.getMessage());
					}
				}
				if (!LegacyFirstLegRepairSafety.confirmed(args)) {
					System.out.println("Legacy first-leg repair preflight passed; no changes made.");
					return;
				}
				for (String code : validated) {
					try {
						var result = repair.repair(code);
						System.out.printf("Legacy repair result: order=%s state=%s outcome=%s%n",
								code, result.firstLegStatus(), result.outcome());
					} catch (RuntimeException exception) {
						System.out.printf("Legacy repair skipped: order=%s reason=%s%n", code, exception.getMessage());
					}
				}
			};
		}
	}
}
