package com.horsetransport;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;

final class PostgresMigrationAssertions {

	private PostgresMigrationAssertions() {
	}

	static void assertCanonicalHistory(JdbcTemplate jdbcTemplate) {
		List<HistoryRow> history = jdbcTemplate.query("""
				select version, script, checksum, success
				from flyway_schema_history
				where version is not null
				order by installed_rank
				""", (resultSet, rowNumber) -> new HistoryRow(
				resultSet.getString("version"),
				resultSet.getString("script"),
				resultSet.getObject("checksum", Integer.class),
				resultSet.getBoolean("success")));

		assertThat(history).containsExactly(
				new HistoryRow("1", "V1__initial_schema.sql", -1027814250, true),
				new HistoryRow("2", "V2__deposit_refund_retries.sql", 1542157360, true),
				new HistoryRow("3", "V3__add_frc_eligible_to_transport_orders.sql", 0, true),
				new HistoryRow("5", "V5__add_transport_order_code_sequence.sql", 125409323, true));
	}

	static void assertRefundSchema(JdbcTemplate jdbcTemplate) {
		ColumnMetadata retryCount = column(jdbcTemplate, "retry_count");
		assertThat(retryCount.dataType()).isEqualTo("integer");
		assertThat(retryCount.nullable()).isEqualTo("NO");
		assertThat(retryCount.defaultValue()).contains("0");

		ColumnMetadata nextAttemptAt = column(jdbcTemplate, "next_attempt_at");
		assertThat(nextAttemptAt.dataType()).isEqualTo("timestamp without time zone");
		assertThat(nextAttemptAt.nullable()).isEqualTo("YES");
		assertThat(nextAttemptAt.defaultValue()).isNull();

		List<String> checkConstraints = jdbcTemplate.queryForList("""
				select pg_get_constraintdef(oid)
				from pg_constraint
				where conrelid = 'deposit_refunds'::regclass
					and contype = 'c'
				""", String.class);
		assertThat(checkConstraints).anySatisfy(definition ->
				assertThat(definition).contains("retry_count", ">= 0"));

		String indexDefinition = jdbcTemplate.queryForObject("""
				select indexdef
				from pg_indexes
				where schemaname = 'public'
					and tablename = 'deposit_refunds'
					and indexname = 'idx_deposit_refunds_retryable'
				""", String.class);
		assertThat(indexDefinition)
				.contains("(next_attempt_at)")
				.contains("WHERE (completed_at IS NULL)");
	}

	static void assertOrderCodeSequenceExists(JdbcTemplate jdbcTemplate) {
		String sequenceName = jdbcTemplate.queryForObject(
				"select to_regclass('public.transport_order_code_seq')::text", String.class);
		assertThat(sequenceName).isEqualTo("transport_order_code_seq");
	}

	static void assertProofOfDeliverySchema(JdbcTemplate jdbcTemplate) {
		List<String> checkConstraints = jdbcTemplate.queryForList("""
				select pg_get_constraintdef(oid)
				from pg_constraint
				where conrelid = 'proofs_of_delivery'::regclass
					and contype = 'c'
				""", String.class);
		assertThat(checkConstraints).anySatisfy(definition ->
				assertThat(definition).contains("road_vehicle_execution_id", "air_leg_execution_id"));
		assertThat(checkConstraints).anySatisfy(definition ->
				assertThat(definition).contains("recipient_name", "btrim"));

		List<String> uniqueIndexes = jdbcTemplate.queryForList("""
				select indexdef
				from pg_indexes
				where schemaname = 'public'
					and tablename = 'proofs_of_delivery'
					and indexname in ('uq_proofs_of_delivery_road_execution',
						'uq_proofs_of_delivery_air_execution')
				order by indexname
				""", String.class);
		assertThat(uniqueIndexes).hasSize(2).allSatisfy(definition ->
				assertThat(definition).contains("CREATE UNIQUE INDEX", "WHERE"));
	}

	static void assertNotificationSchema(JdbcTemplate jdbcTemplate) {
		List<String> uniqueConstraints = jdbcTemplate.queryForList("""
				select pg_get_constraintdef(oid)
				from pg_constraint
				where conrelid = 'notifications'::regclass
					and contype = 'u'
				""", String.class);
		assertThat(uniqueConstraints).anySatisfy(definition ->
				assertThat(definition).contains("recipient_user_id", "source_event_key"));
	}

	static void assertFrcEligibleColumnIsAbsent(JdbcTemplate jdbcTemplate) {
		Integer frcEligibleColumns = jdbcTemplate.queryForObject("""
				select count(*)
				from information_schema.columns
				where table_schema = 'public'
					and table_name = 'transport_orders'
					and column_name = 'frc_eligible'
				""", Integer.class);
		assertThat(frcEligibleColumns).isZero();
	}

	private static ColumnMetadata column(JdbcTemplate jdbcTemplate, String columnName) {
		return jdbcTemplate.queryForObject("""
				select data_type, is_nullable, column_default
				from information_schema.columns
				where table_schema = 'public'
					and table_name = 'deposit_refunds'
					and column_name = ?
				""", (resultSet, rowNumber) -> new ColumnMetadata(
				resultSet.getString("data_type"),
				resultSet.getString("is_nullable"),
				resultSet.getString("column_default")), columnName);
	}

	private record HistoryRow(String version, String script, Integer checksum, boolean success) {
	}

	private record ColumnMetadata(String dataType, String nullable, String defaultValue) {
	}
}
