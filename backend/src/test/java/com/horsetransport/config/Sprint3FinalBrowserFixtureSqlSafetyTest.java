package com.horsetransport.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class Sprint3FinalBrowserFixtureSqlSafetyTest {

	private static String script(String name) throws IOException {
		return Files.readString(Path.of("scripts", name));
	}

	private static int occurrences(String text, String token) {
		return (text.length() - text.replace(token, "").length()) / token.length();
	}

	private static int parenthesisBalance(String sql) {
		int balance = 0;
		boolean quoted = false;
		for (int index = 0; index < sql.length(); index++) {
			char current = sql.charAt(index);
			if (current == '\'' && quoted && index + 1 < sql.length() && sql.charAt(index + 1) == '\'') index++;
			else if (current == '\'') quoted = !quoted;
			else if (!quoted && current == '(') balance++;
			else if (!quoted && current == ')') balance--;
			assertThat(balance).as("SQL closes no parenthesis before it opens").isGreaterThanOrEqualTo(0);
		}
		return balance;
	}

	@Test
	void scriptsHaveBalancedParentheses() throws IOException {
		assertThat(parenthesisBalance(script("sprint3-final-browser-target-preflight.sql"))).isZero();
		assertThat(parenthesisBalance(script("sprint3-final-browser-e2e-fixtures.sql"))).isZero();
	}

	@Test
	void preflightIsReadOnlyAndUsesTheApprovedProductionLabeledTargetGuard() throws IOException {
		String sql = script("sprint3-final-browser-target-preflight.sql");
		String sharedGuard = script("sprint3-road-road-target-preflight.sql");

		assertThat(sql).contains("\\ir sprint3-road-road-target-preflight.sql",
				"BEGIN TRANSACTION READ ONLY", "ROLLBACK;", "transaction_read_only")
				.contains("S3QA-AIR-MVR-001", "S3QA-AIR-FINAL-001")
				.contains("information_schema.columns", "pg_enum", "flyway_schema_history")
				.contains("driver1.s3demo@example.com", "driver2.s3demo@example.com",
						"escort1.s3demo@example.com", "escort2.s3demo@example.com",
						"lm.s3demo@example.com", "customer.s3demo@example.com")
				.contains("execution.status IN ('NOT_STARTED', 'IN_PROGRESS', 'DESTINATION')")
				.doesNotContain("S3_QA_NON_PRODUCTION", "password=", "PGPASSWORD", "jdbc:",
						"INSERT INTO", "UPDATE ", "DELETE FROM", "TRUNCATE", "DROP TABLE");
		assertThat(sharedGuard).contains("SUPABASE_SHARED_POOLER_SESSION", "approved_pooler_username",
				"approved_tls_mode", "sslmode=%s", "ARRAY['1', '2', '3', '5']::text[]")
				.doesNotContain("approved_server_address", "inet_server_addr()");
	}

	@Test
	void setupRequiresIndependentConfirmationForBothExactFixtures() throws IOException {
		String sql = script("sprint3-final-browser-e2e-fixtures.sql");

		assertThat(sql).contains("write_confirmation_air_mvr", "write_confirmation_air_final",
				"WRITE-S3QA-AIR-MVR-001@horse-transport-system/PRODUCTION",
				"WRITE-S3QA-AIR-FINAL-001@horse-transport-system/PRODUCTION")
				.contains("\\ir sprint3-final-browser-target-preflight.sql", "BEGIN;", "COMMIT;")
				.doesNotContain("S3_QA_NON_PRODUCTION", "password=", "PGPASSWORD", "jdbc:");
	}

	@Test
	void setupCreatesExactlyTwentyFourInitialGraphRecords() throws IOException {
		String sql = script("sprint3-final-browser-e2e-fixtures.sql");

		assertThat(occurrences(sql, "  INSERT INTO ")).isEqualTo(24);
		assertThat(occurrences(sql, "  INSERT INTO horses")).isEqualTo(3);
		assertThat(occurrences(sql, "  INSERT INTO transport_orders")).isEqualTo(2);
		assertThat(occurrences(sql, "  INSERT INTO transport_order_horses")).isEqualTo(3);
		assertThat(occurrences(sql, "  INSERT INTO vehicles")).isEqualTo(2);
		assertThat(occurrences(sql, "  INSERT INTO route_plans")).isEqualTo(2);
		assertThat(occurrences(sql, "  INSERT INTO route_legs")).isEqualTo(3);
		assertThat(occurrences(sql, "  INSERT INTO road_leg_vehicles")).isEqualTo(2);
		assertThat(occurrences(sql, "  INSERT INTO road_leg_vehicle_horses")).isEqualTo(2);
		assertThat(occurrences(sql, "  INSERT INTO road_vehicle_executions")).isEqualTo(2);
		assertThat(occurrences(sql, "  INSERT INTO air_leg_executions")).isEqualTo(2);
		assertThat(occurrences(sql, "  INSERT INTO checkpoints")).isEqualTo(1);
	}

	@Test
	void initialStatesAndAllocationsMatchTheTwoConfirmedWorkflows() throws IOException {
		String sql = script("sprint3-final-browser-e2e-fixtures.sql");

		assertThat(sql).contains("'S3QA-AIR-MVR-001'", "'COMBINED'", "'S3QA-AIR-FINAL-001'", "'AIR'")
				.contains("'READY_TO_SHIP'", "'APPROVED'", "'READY'", "'PLANNED'", "'NOT_STARTED'")
				.contains("'d5200000-0000-0000-0000-000000000001'",
						"'d5200000-0000-0000-0000-000000000002'",
						"'d5600000-0000-0000-0000-000000000001'",
						"'d5600000-0000-0000-0000-000000000002'")
				.contains("driver1, escort1, 'NOT_STARTED'", "driver2, escort2, 'NOT_STARTED'",
						"escort1, 'NOT_STARTED'")
				.contains("Shared checkpoint; each Vehicle records its own arrival and welfare");
	}

	@Test
	void setupFailsClosedAndCannotCreateLifecycleEvidenceOrTouchOtherFixtures() throws IOException {
		String sql = script("sprint3-final-browser-e2e-fixtures.sql");

		assertThat(sql).contains("identifier or business key already exists; no rows were inserted",
				"role = 'DRIVER' AND status = 'ACTIVE'", "role = 'ESCORT' AND status = 'ACTIVE'",
				"A selected Driver has an overlapping non-completed ROAD assignment",
				"A selected Escort has an overlapping non-completed ROAD/AIR assignment",
				"A synthetic Vehicle identifier has a conflicting allocation")
				.doesNotContain("INSERT INTO welfare_evidence", "INSERT INTO proofs_of_delivery",
						"INSERT INTO vehicle_checkpoint_arrivals", "INSERT INTO notifications",
						"ON CONFLICT", "UPDATE ", "DELETE FROM", "TRUNCATE", "DROP TABLE",
						"S3QA-R2R-001", "S3DEMO-");
	}

	@Test
	void fixedScheduleAndSchemaConstraintsAreCompatible() throws IOException {
		String setup = script("sprint3-final-browser-e2e-fixtures.sql");
		String schema = Files.readString(Path.of("src", "main", "resources", "db", "migration",
				"V1__initial_schema.sql"));
		String routePlanService = Files.readString(Path.of("src", "main", "java", "com",
				"horsetransport", "route", "RoutePlanService.java"));

		assertThat(setup).contains("timestamp '2099-02-01 08:00:00'",
				"timestamp '2099-02-01 12:00:00'", "timestamp '2099-02-01 13:00:00'",
				"timestamp '2099-02-01 18:00:00'", "timestamp '2099-02-02 08:00:00'",
				"timestamp '2099-02-02 12:00:00'");
		assertThat(schema).contains("planned_departure_at < planned_arrival_at",
				"UNIQUE (route_plan_id, sequence_no)", "UNIQUE (route_leg_id, transport_order_horse_id)",
				"air_capacity_horses > 0", "horse_capacity > 0");
		assertThat(routePlanService).contains("next.getPlannedDepartureAt().isBefore(current.getPlannedArrivalAt())");
	}
}
