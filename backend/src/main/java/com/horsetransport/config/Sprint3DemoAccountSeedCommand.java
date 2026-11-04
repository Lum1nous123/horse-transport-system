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

public final class Sprint3DemoAccountSeedCommand {
	private Sprint3DemoAccountSeedCommand() { }

	public static void main(String[] args) {
		DemoStaffSeedSafety.validateLaunchInputs(System.getenv(), System.getProperties(), args);
		DemoStaffSeedSafety.disableDevToolsRestart();
		try (ConfigurableApplicationContext ignored = new SpringApplicationBuilder(Config.class)
				.web(WebApplicationType.NONE).profiles(DemoStaffSeedSafety.PROFILE)
				.initializers(context -> {
					DemoStaffSeedSafety.installSafetyOverrides(context.getEnvironment());
					DemoStaffSeedSafety.validateResolvedEnvironment(context.getEnvironment());
				}).properties("spring.main.banner-mode=off").run(args)) { }
	}

	@Configuration(proxyBeanMethods = false)
	@EnableAutoConfiguration(exclude = {FlywayAutoConfiguration.class,
			DataSourceInitializationAutoConfiguration.class, TaskSchedulingAutoConfiguration.class,
			SecurityAutoConfiguration.class, UserDetailsServiceAutoConfiguration.class})
	@EntityScan(basePackageClasses = BackendApplication.class)
	@EnableJpaRepositories(basePackageClasses = UserRepository.class)
	@Import(Sprint3DemoAccountSeeder.class)
	@Profile(DemoStaffSeedSafety.PROFILE)
	static class Config {
		@Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }
		@Bean DemoStaffDatabasePreflight preflight(DataSource dataSource) {
			return new DemoStaffDatabasePreflight(dataSource);
		}
		@Bean ApplicationRunner runner(Sprint3DemoAccountSeeder seeder,
				DemoStaffDatabasePreflight preflight, Environment environment) {
			return (ApplicationArguments arguments) -> {
				preflight.verify(DemoStaffSeedSafety.approvedTarget(environment));
				if (!DemoStaffSeedSafety.writeConfirmed(arguments)) {
					System.out.println("Sprint 3 demo account preflight passed; no changes made.");
					return;
				}
				var result = seeder.seed(environment.getProperty(DemoStaffSeedSafety.PASSWORD_PROPERTY));
				System.out.printf("Sprint 3 demo accounts: created=%d, existing=%d%n",
						result.created(), result.existing());
			};
		}
	}
}
