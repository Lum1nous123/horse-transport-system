package com.horsetransport.config;

import java.net.URI;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Properties;
import java.util.Set;

import org.springframework.core.env.Environment;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

final class DemoStaffSeedSafety {

	static final String PROFILE = "demo-staff-command";
	static final String CONFIRMATION_OPTION = "confirm-demo-staff-seed";
	static final String PASSWORD_PROPERTY = "HTS_DEMO_STAFF_PASSWORD";
	static final String EXPECTED_HOST_PROPERTY = "HTS_DEMO_STAFF_EXPECTED_HOST";
	static final String EXPECTED_DATABASE_PROPERTY = "HTS_DEMO_STAFF_EXPECTED_DATABASE";
	static final String EXPECTED_SCHEMA_PROPERTY = "HTS_DEMO_STAFF_EXPECTED_SCHEMA";

	private static final Set<String> FORBIDDEN_EXACT_ENVIRONMENT_KEYS = Set.of(
			"DATABASE_URL", "JDBC_DATABASE_URL", "JDBC_URL", "DB_URL", "DB_JDBC_URL",
			"POSTGRES_URL", "POSTGRESQL_URL", "SUPABASE_DB_URL", "SPRING_APPLICATION_JSON",
			"PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD", "PGSERVICE", "PGSERVICEFILE");
	private static final Set<String> FORBIDDEN_ENVIRONMENT_PREFIXES = Set.of(
			"SPRING_DATASOURCE_", "SPRING_FLYWAY_", "SPRING_CONFIG_", "SPRING_PROFILES_",
			"SPRING_JPA_", "SPRING_SQL_", "SPRING_DEVTOOLS_", "FLYWAY_");
	private static final Set<String> FORBIDDEN_SYSTEM_PROPERTY_PREFIXES = Set.of(
			"spring.datasource.", "spring.flyway.", "spring.config.", "spring.profiles.",
			"spring.jpa.", "spring.sql.", "flyway.");

	private DemoStaffSeedSafety() {
	}

	static void disableDevToolsRestart() {
		System.setProperty("spring.devtools.restart.enabled", "false");
	}

	static void installSafetyOverrides(ConfigurableEnvironment environment) {
		Map<String, Object> safetyOverrides = new LinkedHashMap<>();
		safetyOverrides.put("spring.flyway.enabled", "false");
		safetyOverrides.put("spring.jpa.hibernate.ddl-auto", "validate");
		safetyOverrides.put("spring.jpa.generate-ddl", "false");
		safetyOverrides.put("spring.sql.init.mode", "never");
		safetyOverrides.put("spring.main.web-application-type", "none");
		safetyOverrides.put("spring.devtools.restart.enabled", "false");
		environment.getPropertySources().addFirst(
				new MapPropertySource("demoStaffSeedSafetyOverrides", safetyOverrides));
	}

	static void validateLaunchInputs(Map<String, String> environment, Properties systemProperties, String[] args) {
		validateArguments(args);
		for (String rawKey : environment.keySet()) {
			String key = rawKey.toUpperCase(Locale.ROOT);
			if (FORBIDDEN_EXACT_ENVIRONMENT_KEYS.contains(key)
					|| FORBIDDEN_ENVIRONMENT_PREFIXES.stream().anyMatch(key::startsWith)) {
				throw new DemoStaffSeedSafetyException("Forbidden environment override is set: " + key);
			}
		}
		for (String key : systemProperties.stringPropertyNames()) {
			String normalized = key.toLowerCase(Locale.ROOT);
			if (FORBIDDEN_SYSTEM_PROPERTY_PREFIXES.stream().anyMatch(normalized::startsWith)) {
				throw new DemoStaffSeedSafetyException("Forbidden JVM property override is set: " + key);
			}
		}
		requireNonBlank(environment, "DB_HOST");
		requireNonBlank(environment, "DB_NAME");
		requireNonBlank(environment, "DB_USERNAME");
		requireNonBlank(environment, "DB_PASSWORD");
		requireNonBlank(environment, EXPECTED_HOST_PROPERTY);
		requireNonBlank(environment, EXPECTED_DATABASE_PROPERTY);
		requireNonBlank(environment, EXPECTED_SCHEMA_PROPERTY);
		validatePort(environment.get("DB_PORT"));
	}

	static void validateResolvedEnvironment(Environment environment) {
		Set<String> activeProfiles = new HashSet<>(Arrays.asList(environment.getActiveProfiles()));
		if (!activeProfiles.equals(Set.of(PROFILE))) {
			throw new DemoStaffSeedSafetyException(
					"Active profiles must contain only " + PROFILE + "; found " + activeProfiles);
		}

		ApprovedDatabaseTarget approved = approvedTarget(environment);
		JdbcTarget resolved = parseJdbcUrl(required(environment, "spring.datasource.url"));
		if (!sameHost(resolved.host(), approved.host())
				|| !resolved.database().equals(approved.database())) {
			throw new DemoStaffSeedSafetyException("Resolved datasource does not match the approved host/database");
		}
		if (!required(environment, "spring.datasource.username").equals(required(environment, "DB_USERNAME"))) {
			throw new DemoStaffSeedSafetyException("Resolved datasource username does not match DB_USERNAME");
		}
		if (!required(environment, "spring.datasource.password").equals(required(environment, "DB_PASSWORD"))) {
			throw new DemoStaffSeedSafetyException("Resolved datasource password does not match DB_PASSWORD");
		}
	}

	static ApprovedDatabaseTarget approvedTarget(Environment environment) {
		String configuredHost = required(environment, "DB_HOST");
		String configuredDatabase = required(environment, "DB_NAME");
		String expectedHost = required(environment, EXPECTED_HOST_PROPERTY);
		String expectedDatabase = required(environment, EXPECTED_DATABASE_PROPERTY);
		if (!sameHost(configuredHost, expectedHost) || !configuredDatabase.equals(expectedDatabase)) {
			throw new DemoStaffSeedSafetyException(
					"DB_HOST/DB_NAME do not match the explicitly approved database target");
		}
		return new ApprovedDatabaseTarget(expectedHost, expectedDatabase,
				required(environment, EXPECTED_SCHEMA_PROPERTY));
	}

	static boolean writeConfirmed(org.springframework.boot.ApplicationArguments arguments) {
		return arguments.containsOption(CONFIRMATION_OPTION);
	}

	private static void validateArguments(String[] args) {
		for (String argument : args) {
			if (!("--" + CONFIRMATION_OPTION).equals(argument)) {
				throw new DemoStaffSeedSafetyException("Unsupported command argument: " + argument);
			}
		}
	}

	private static void validatePort(String port) {
		if (port == null || port.isBlank()) {
			return;
		}
		try {
			int value = Integer.parseInt(port);
			if (value < 1 || value > 65535) {
				throw new NumberFormatException();
			}
		}
		catch (NumberFormatException exception) {
			throw new DemoStaffSeedSafetyException("DB_PORT must be a valid TCP port");
		}
	}

	private static JdbcTarget parseJdbcUrl(String jdbcUrl) {
		if (!jdbcUrl.startsWith("jdbc:postgresql://")) {
			throw new DemoStaffSeedSafetyException("Only a PostgreSQL JDBC datasource is allowed");
		}
		try {
			URI uri = URI.create(jdbcUrl.substring("jdbc:".length()));
			String database = uri.getPath() == null ? "" : uri.getPath().replaceFirst("^/", "");
			if (uri.getHost() == null || database.isBlank()) {
				throw new IllegalArgumentException();
			}
			return new JdbcTarget(uri.getHost(), database);
		}
		catch (IllegalArgumentException exception) {
			throw new DemoStaffSeedSafetyException("Datasource URL cannot be validated as PostgreSQL host/database");
		}
	}

	private static boolean sameHost(String left, String right) {
		return left.trim().equalsIgnoreCase(right.trim());
	}

	private static String required(Environment environment, String name) {
		String value = environment.getProperty(name);
		if (value == null || value.isBlank()) {
			throw new DemoStaffSeedSafetyException("Required configuration is missing: " + name);
		}
		return value.trim();
	}

	private static void requireNonBlank(Map<String, String> environment, String name) {
		String value = environment.entrySet().stream()
				.filter(entry -> entry.getKey().equalsIgnoreCase(name))
				.map(Map.Entry::getValue)
				.findFirst().orElse(null);
		if (value == null || value.isBlank()) {
			throw new DemoStaffSeedSafetyException("Required environment variable is missing: " + name);
		}
	}

	record ApprovedDatabaseTarget(String host, String database, String schema) {
		ApprovedDatabaseTarget {
			Objects.requireNonNull(host);
			Objects.requireNonNull(database);
			Objects.requireNonNull(schema);
		}
	}

	private record JdbcTarget(String host, String database) {
	}
}
