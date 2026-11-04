package com.horsetransport.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class Sprint3DemoSqlSafetyTest {

	private static String script(String name) throws IOException {
		return Files.readString(Path.of("scripts", name));
	}

	private static int parenthesisBalance(String sql) {
		int balance = 0;
		boolean quoted = false;
		for (int index = 0; index < sql.length(); index++) {
			char current = sql.charAt(index);
			if (current == '\'' && (index + 1 >= sql.length() || sql.charAt(index + 1) != '\'')) quoted = !quoted;
			else if (!quoted && current == '(') balance++;
			else if (!quoted && current == ')') balance--;
			assertThat(balance).as("SQL closes no parenthesis before it opens").isGreaterThanOrEqualTo(0);
		}
		return balance;
	}

	@Test
	void scriptsHaveBalancedParentheses() throws IOException {
		assertThat(parenthesisBalance(script("cleanup-sprint3-demo-fixtures.sql"))).isZero();
		assertThat(parenthesisBalance(script("sprint3-demo-fixtures.sql"))).isZero();
	}

	@Test
	void cleanupUsesExactOrderNamespaceAndRelationalScopes() throws IOException {
		String sql = script("cleanup-sprint3-demo-fixtures.sql");

		assertThat(sql).contains("BEGIN;", "COMMIT;")
				.contains("order_code IN ('S3DEMO-ROAD-MULTI', 'S3DEMO-AIR-NONFINAL', 'S3DEMO-AIR-FINAL')")
				.contains("CREATE TEMP TABLE s3_demo_order_ids ON COMMIT DROP")
				.contains("CREATE TEMP TABLE s3_demo_road_execution_ids ON COMMIT DROP")
				.contains("CREATE TEMP TABLE s3_demo_air_execution_ids ON COMMIT DROP")
				.doesNotContain("id::text LIKE", "order_code LIKE", "microchip_id LIKE", "plate_number LIKE");
	}

	@Test
	void missingFixtureTakesTransactionalInsertPath() throws IOException {
		String sql = script("sprint3-demo-fixtures.sql");

		assertThat(sql).contains("BEGIN;", "COMMIT;")
				.contains("INSERT INTO transport_orders", "INSERT INTO route_legs")
				.contains("INSERT INTO road_vehicle_executions", "INSERT INTO air_leg_executions");
	}

	@Test
	void completeFixtureRequiresExpectedGraphBeforeNoOp() throws IOException {
		String sql = script("sprint3-demo-fixtures.sql");

		assertThat(sql).contains("Complete Sprint 3 fixtures already exist; no changes made")
				.contains("road_leg_vehicle_horses", "road_vehicle_executions", "air_leg_executions", "checkpoints")
				.contains("driver_id=driver1 AND escort_id=escort1")
				.contains("driver_id=driver2 AND escort_id=escort2")
				.contains("status IN ('PLANNED','READY','IN_PROGRESS','COMPLETED')");
	}

	@Test
	void partialFixtureFailsClosedInsteadOfRebuilding() throws IOException {
		String sql = script("sprint3-demo-fixtures.sql");

		assertThat(sql).contains("Sprint 3 demo namespace is partial or inconsistent")
				.contains("run only the scoped cleanup after explicit approval")
				.doesNotContain("ON CONFLICT DO UPDATE", "TRUNCATE", "DROP TABLE");
	}
}
