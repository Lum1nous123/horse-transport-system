package com.horsetransport.config;

import java.net.URI;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;
import java.util.Set;

import org.springframework.boot.ApplicationArguments;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.Environment;
import org.springframework.core.env.MapPropertySource;

final class LegacyFirstLegRepairSafety {
	static final String PROFILE = "legacy-first-leg-repair-command";
	static final String CONFIRMATION_OPTION = "confirm-legacy-first-leg-repair";
	static final String REASSIGNMENT_CONFIRMATION_OPTION = "confirm-legacy-execution-reassignment";
	static final String EXPECTED_HOST = "HTS_LEGACY_REPAIR_EXPECTED_HOST";
	static final String EXPECTED_DATABASE = "HTS_LEGACY_REPAIR_EXPECTED_DATABASE";
	static final String EXPECTED_SCHEMA = "HTS_LEGACY_REPAIR_EXPECTED_SCHEMA";
	private static final Set<String> ALLOWED_ARGS = Set.of("--" + CONFIRMATION_OPTION);

	private LegacyFirstLegRepairSafety() { }

	static void validateLaunchInputs(Map<String, String> env, Properties properties, String[] args) {
		validateLaunchInputs(env, properties, args, CONFIRMATION_OPTION);
	}

	static void validateLaunchInputs(Map<String, String> env, Properties properties, String[] args,
			String confirmationOption) {
		Set<String> allowed = Set.of("--" + confirmationOption);
		for (String arg : args) if (!allowed.contains(arg)) fail("Unsupported command argument: " + arg);
		for (String key : env.keySet()) {
			String normalized = key.toUpperCase();
			if (normalized.equals("DATABASE_URL") || normalized.equals("JDBC_DATABASE_URL")
					|| normalized.equals("JDBC_URL") || normalized.equals("DB_URL")
					|| normalized.equals("POSTGRES_URL") || normalized.equals("SUPABASE_DB_URL")
					|| normalized.equals("PGHOST") || normalized.equals("PGPORT")
					|| normalized.equals("PGDATABASE") || normalized.equals("PGUSER")
					|| normalized.equals("PGPASSWORD") || normalized.equals("PGSERVICE")
					|| normalized.equals("SPRING_APPLICATION_JSON") || normalized.startsWith("SPRING_DATASOURCE_")
					|| normalized.startsWith("SPRING_FLYWAY_") || normalized.startsWith("SPRING_CONFIG_")
					|| normalized.startsWith("SPRING_PROFILES_") || normalized.startsWith("FLYWAY_")) {
				fail("Forbidden environment override is set: " + normalized);
			}
		}
		for (String key : properties.stringPropertyNames()) {
			String normalized = key.toLowerCase();
			if (normalized.startsWith("spring.datasource.") || normalized.startsWith("spring.flyway.")
					|| normalized.startsWith("spring.config.") || normalized.startsWith("spring.profiles.")) {
				fail("Forbidden JVM property override is set: " + key);
			}
		}
		for (String key : Set.of("DB_HOST", "DB_NAME", "DB_USERNAME", "DB_PASSWORD",
				EXPECTED_HOST, EXPECTED_DATABASE, EXPECTED_SCHEMA)) {
			if (env.get(key) == null || env.get(key).isBlank()) fail("Required environment variable is missing: " + key);
		}
		if (!same(env.get("DB_HOST"), env.get(EXPECTED_HOST)) || !env.get("DB_NAME").equals(env.get(EXPECTED_DATABASE))) {
			fail("Configured datasource identity does not match the explicitly approved target");
		}
	}

	static void installSafetyOverrides(ConfigurableEnvironment environment) {
		Map<String, Object> values = new LinkedHashMap<>();
		values.put("spring.flyway.enabled", "false");
		values.put("spring.jpa.hibernate.ddl-auto", "validate");
		values.put("spring.jpa.generate-ddl", "false");
		values.put("spring.sql.init.mode", "never");
		values.put("spring.main.web-application-type", "none");
		values.put("spring.devtools.restart.enabled", "false");
		environment.getPropertySources().addFirst(new MapPropertySource("legacyRepairSafety", values));
	}

	static void validateResolved(Environment environment) {
		Set<String> profiles = new HashSet<>(Arrays.asList(environment.getActiveProfiles()));
		if (!profiles.equals(Set.of(PROFILE))) fail("Unexpected active profiles: " + profiles);
		URI uri;
		try { uri = URI.create(required(environment, "spring.datasource.url").substring("jdbc:".length())); }
		catch (RuntimeException exception) { throw new DemoStaffSeedSafetyException("Datasource URL is invalid"); }
		if (!"postgresql".equals(uri.getScheme()) || !same(uri.getHost(), required(environment, EXPECTED_HOST))
				|| !uri.getPath().replaceFirst("^/", "").equals(required(environment, EXPECTED_DATABASE))) {
			fail("Resolved datasource does not match the explicitly approved PostgreSQL target");
		}
		if (!required(environment, "spring.datasource.username").equals(required(environment, "DB_USERNAME"))
				|| !required(environment, "spring.datasource.password").equals(required(environment, "DB_PASSWORD"))) {
			fail("Resolved datasource credentials do not match the reviewed local configuration");
		}
	}

	static DemoStaffSeedSafety.ApprovedDatabaseTarget target(Environment environment) {
		return new DemoStaffSeedSafety.ApprovedDatabaseTarget(required(environment, EXPECTED_HOST),
				required(environment, EXPECTED_DATABASE), required(environment, EXPECTED_SCHEMA));
	}

	static boolean confirmed(ApplicationArguments arguments) { return arguments.containsOption(CONFIRMATION_OPTION); }
	static boolean confirmed(ApplicationArguments arguments, String option) { return arguments.containsOption(option); }
	private static boolean same(String a, String b) { return a != null && b != null && a.trim().equalsIgnoreCase(b.trim()); }
	private static String required(Environment environment, String key) {
		String value = environment.getProperty(key);
		if (value == null || value.isBlank()) fail("Required configuration is missing: " + key);
		return value.trim();
	}
	private static void fail(String message) { throw new DemoStaffSeedSafetyException(message); }
}
