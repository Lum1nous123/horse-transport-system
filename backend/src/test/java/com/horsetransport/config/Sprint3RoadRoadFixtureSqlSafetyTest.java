package com.horsetransport.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.junit.jupiter.api.Test;

class Sprint3RoadRoadFixtureSqlSafetyTest {

	private static String script(String name) throws IOException {
		return Files.readString(Path.of("scripts", name));
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
	void allRoadRoadScriptsHaveBalancedParentheses() throws IOException {
		assertThat(parenthesisBalance(script("sprint3-road-road-target-preflight.sql"))).isZero();
		assertThat(parenthesisBalance(script("sprint3-road-road-e2e-fixture.sql"))).isZero();
		assertThat(parenthesisBalance(script("cleanup-sprint3-road-road-e2e-fixture.sql"))).isZero();
		assertThat(parenthesisBalance(script("sprint3-road-road-cloudinary-manifest.sql"))).isZero();
	}

	@Test
	void identityPreflightIsReadOnlyAndRequiresIndependentTargetMetadata() throws IOException {
		String sql = script("sprint3-road-road-target-preflight.sql");

		assertThat(sql).contains("BEGIN TRANSACTION READ ONLY", "ROLLBACK;")
				.contains("approved_project_name", "approved_supabase_project_ref",
						"approved_endpoint_host", "approved_endpoint_port", "approved_branch_label", "approved_usage",
						"approved_database", "approved_schema", "approved_connection_mode",
						"approved_pooler_username", "approved_tls_mode")
				.contains("horse-transport-system", "PRODUCTION",
						"OWNER_APPROVED_DEVELOPMENT_DEMO", "SUPABASE_SHARED_POOLER_SESSION",
						"'postgres.' || :'approved_supabase_project_ref'", "'approved_tls_mode' = 'require'",
						"sslmode=%s", "\\connect -reuse-previous=on")
				.contains("814cef875a841e006192296ac254dea7",
						"3b60ba7400f233a67f06bb00db897aa0")
				.contains("current_database()", "current_schema()", "transaction_read_only",
						"flyway_schema_history", "ARRAY['1', '2', '3', '5']::text[]")
				.doesNotContain("approved_server_address", "inet_server_addr()")
				.doesNotContain("S3_QA_NON_PRODUCTION", "password=", "PGPASSWORD", "jdbc:",
						"INSERT INTO", "UPDATE ", "DELETE FROM", "TRUNCATE", "DROP TABLE");
	}

	@Test
	void setupCreatesOnlyTheExactFreshTwoLegRoadGraph() throws IOException {
		String sql = script("sprint3-road-road-e2e-fixture.sql");

		assertThat(sql).contains("write_confirmation",
						"WRITE-S3QA-R2R-001@horse-transport-system/PRODUCTION", "BEGIN;", "COMMIT;")
				.contains("'READY_TO_SHIP'", "'APPROVED'", "'READY'", "'PLANNED'", "'NOT_STARTED'")
				.contains("S3QA-R2R-MICRO-001", "S3QA-R2R-01", "S3QA-R2R-02")
				.contains("driver1.s3demo@example.com", "driver2.s3demo@example.com",
						"escort1.s3demo@example.com", "escort2.s3demo@example.com")
				.contains("role = 'DRIVER' AND status = 'ACTIVE'", "role = 'ESCORT' AND status = 'ACTIVE'")
				.contains("execution.status IN ('NOT_STARTED', 'IN_PROGRESS', 'DESTINATION')")
				.contains("leg1_start < leg.planned_arrival_at AND leg1_end > leg.planned_departure_at")
				.contains("leg2_start < leg.planned_arrival_at AND leg2_end > leg.planned_departure_at")
				.contains("INSERT INTO horses", "INSERT INTO transport_orders",
						"INSERT INTO transport_order_horses", "INSERT INTO vehicles",
						"INSERT INTO route_plans", "INSERT INTO route_legs",
						"INSERT INTO road_leg_vehicles", "INSERT INTO road_leg_vehicle_horses",
						"INSERT INTO road_vehicle_executions", "INSERT INTO checkpoints")
				.doesNotContain("INSERT INTO welfare_evidence", "INSERT INTO proofs_of_delivery",
						"INSERT INTO vehicle_checkpoint_arrivals", "ON CONFLICT", "UPDATE ",
						"TRUNCATE", "DROP TABLE", "LIKE 'S3QA");
	}

	@Test
	void sameHorseTransfersToDifferentVehiclesWithoutIntermediatePod() throws IOException {
		String setup = script("sprint3-road-road-e2e-fixture.sql").replace("\r\n", "\n");
		String cleanup = script("cleanup-sprint3-road-road-e2e-fixture.sql");

		assertThat(setup)
				.contains("'d4600000-0000-0000-0000-000000000001',\n"
						+ "      'd4500000-0000-0000-0000-000000000001',\n"
						+ "      'd4300000-0000-0000-0000-000000000001'",
						"'d4600000-0000-0000-0000-000000000002',\n"
						+ "      'd4500000-0000-0000-0000-000000000002',\n"
						+ "      'd4300000-0000-0000-0000-000000000002'",
						"'d4700000-0000-0000-0000-000000000001',\n"
						+ "      'd4500000-0000-0000-0000-000000000001',\n"
						+ "      'd4600000-0000-0000-0000-000000000001',\n"
						+ "      'd4200000-0000-0000-0000-000000000001'",
						"'d4700000-0000-0000-0000-000000000002',\n"
						+ "      'd4500000-0000-0000-0000-000000000002',\n"
						+ "      'd4600000-0000-0000-0000-000000000002',\n"
						+ "      'd4200000-0000-0000-0000-000000000001'")
				.doesNotContain("INSERT INTO proofs_of_delivery");
		assertThat(cleanup).contains("road_vehicle_execution_id <> "
				+ "'d4800000-0000-0000-0000-000000000002'");
	}

	@Test
	void setupAndCleanupTablesExistInTheActualSchema() throws IOException {
		String schema = Files.readString(Path.of("src", "main", "resources", "db", "migration",
				"V1__initial_schema.sql"));
		for (String table : List.of("users", "horses", "transport_orders", "transport_order_horses",
				"order_staff_assignments", "quotations", "payments", "horse_documents", "vehicles",
				"route_plans", "route_plan_reviews", "route_legs", "road_leg_vehicles",
				"road_leg_vehicle_horses", "road_vehicle_executions", "air_leg_executions",
				"checkpoints", "vehicle_checkpoint_arrivals", "welfare_evidence",
				"proofs_of_delivery", "notifications", "status_audit_logs")) {
			assertThat(schema).as("schema table %s", table).contains("CREATE TABLE " + table + " (");
		}
		assertThat(schema).contains("'READY_TO_SHIP'", "'APPROVED'", "'PLANNED'", "'READY'",
				"'NOT_STARTED'", "UNIQUE (route_plan_id, sequence_no)",
				"UNIQUE (route_leg_id, transport_order_horse_id)");
	}

	@Test
	void cleanupIsExactAndRefusesToOrphanCloudinaryEvidence() throws IOException {
		String sql = script("cleanup-sprint3-road-road-e2e-fixture.sql");

		assertThat(sql).contains("cleanup_confirmation",
						"CLEANUP-S3QA-R2R-001@horse-transport-system/PRODUCTION")
				.contains("cloudinary_cleanup_confirmation", "S3QA-R2R-001-ASSETS-DELETED")
				.contains("CREATE TEMP TABLE s3qa_r2r_order ON COMMIT DROP")
				.contains("Exact synthetic Order ownership could not be verified")
				.contains("Synthetic Horse or Vehicle is referenced outside the exact fixture graph")
				.contains("DELETE FROM notifications", "DELETE FROM proofs_of_delivery",
						"DELETE FROM welfare_evidence", "DELETE FROM vehicle_checkpoint_arrivals",
						"DELETE FROM status_audit_logs", "DELETE FROM checkpoints",
						"DELETE FROM road_vehicle_executions", "DELETE FROM road_leg_vehicle_horses",
						"DELETE FROM road_leg_vehicles", "DELETE FROM route_legs",
						"DELETE FROM route_plans", "DELETE FROM transport_order_horses",
						"DELETE FROM transport_orders", "DELETE FROM horses", "DELETE FROM vehicles")
				.doesNotContain("DELETE FROM users", "ON CONFLICT", "UPDATE ", "TRUNCATE",
						"DROP TABLE", "order_code LIKE", "id::text LIKE");
	}

	@Test
	void fixedScheduleSatisfiesPersistedAndApplicationTimeOrdering() throws IOException {
		String setup = script("sprint3-road-road-e2e-fixture.sql");
		String schema = Files.readString(Path.of("src", "main", "resources", "db", "migration",
				"V1__initial_schema.sql"));
		String routePlanService = Files.readString(Path.of("src", "main", "java", "com",
				"horsetransport", "route", "RoutePlanService.java"));

		assertThat(setup).contains("timestamp '2099-01-15 08:00:00'",
				"timestamp '2099-01-15 12:00:00'", "timestamp '2099-01-15 13:00:00'",
				"timestamp '2099-01-15 17:00:00'");
		assertThat(schema).contains("planned_departure_at < planned_arrival_at");
		assertThat(routePlanService).contains("next.getPlannedDepartureAt().isBefore(current.getPlannedArrivalAt())");
	}

	@Test
	void cloudinaryManifestIsReadOnlyAndScopedThroughTheExactGraph() throws IOException {
		String sql = script("sprint3-road-road-cloudinary-manifest.sql");

		assertThat(sql).contains("BEGIN TRANSACTION READ ONLY", "ROLLBACK;")
				.contains("d4100000-0000-0000-0000-000000000001", "S3QA-R2R-001")
				.contains("d4800000-0000-0000-0000-000000000001",
						"d4800000-0000-0000-0000-000000000002")
				.contains("evidence.photo_url", "proof.proof_photo_url")
				.doesNotContain("INSERT INTO", "UPDATE ", "DELETE FROM", "TRUNCATE", "DROP TABLE");
	}
}
