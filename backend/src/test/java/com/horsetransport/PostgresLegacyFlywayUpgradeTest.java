package com.horsetransport;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest(properties = {
		"app.security.jwt.secret=01234567890123456789012345678901",
		"spring.jpa.hibernate.ddl-auto=validate"
})
class PostgresLegacyFlywayUpgradeTest {

	private static final String REFUND_ID = "00000000-0000-0000-0000-000000000301";
	private static final LocalDateTime NEXT_ATTEMPT_AT = LocalDateTime.of(2026, 10, 15, 12, 0);
	private static boolean legacyDatabasePrepared;

	@Container
	private static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@DynamicPropertySource
	static synchronized void postgresProperties(DynamicPropertyRegistry registry) {
		if (!postgres.isRunning()) {
			postgres.start();
		}
		if (!legacyDatabasePrepared) {
			prepareLegacyDatabase();
			legacyDatabasePrepared = true;
		}

		registry.add("spring.datasource.url", postgres::getJdbcUrl);
		registry.add("spring.datasource.username", postgres::getUsername);
		registry.add("spring.datasource.password", postgres::getPassword);
	}

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private Flyway flyway;

	@Test
	void productionLikeV1V2DatabaseUpgradesWithoutReapplyingRefundMigration() {
		PostgresMigrationAssertions.assertCanonicalHistory(jdbcTemplate);
		PostgresMigrationAssertions.assertRefundSchema(jdbcTemplate);
		PostgresMigrationAssertions.assertOrderCodeSequenceExists(jdbcTemplate);
		PostgresMigrationAssertions.assertFrcEligibleColumnIsAbsent(jdbcTemplate);
		PostgresMigrationAssertions.assertProofOfDeliverySchema(jdbcTemplate);
		PostgresMigrationAssertions.assertNotificationSchema(jdbcTemplate);
		flyway.validate();
		assertThat(flyway.migrate().migrationsExecuted).isZero();

		assertThat(jdbcTemplate.queryForObject(
				"select count(*) from transport_orders", Integer.class)).isEqualTo(2);
		assertThat(jdbcTemplate.queryForObject("""
				select retry_count
				from deposit_refunds
				where id = ?::uuid
				""", Integer.class, REFUND_ID)).isEqualTo(4);
		assertThat(jdbcTemplate.queryForObject("""
				select next_attempt_at
				from deposit_refunds
				where id = ?::uuid
				""", LocalDateTime.class, REFUND_ID)).isEqualTo(NEXT_ATTEMPT_AT);
		assertThat(jdbcTemplate.queryForObject("""
				select processing_error
				from deposit_refunds
				where id = ?::uuid
				""", String.class, REFUND_ID)).isEqualTo("legacy retry state");

		Long nextSequenceValue = jdbcTemplate.queryForObject(
				"select nextval('transport_order_code_seq')", Long.class);
		assertThat(nextSequenceValue).isEqualTo(10L);
	}

	private static void prepareLegacyDatabase() {
		DriverManagerDataSource dataSource = new DriverManagerDataSource(
				postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());

		Flyway.configure()
				.dataSource(dataSource)
				.locations("classpath:db/migration")
				.target("2")
				.load()
				.migrate();

		JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
		jdbcTemplate.update("""
				insert into users (
					id, full_name, email, password_hash, role, status, created_at
				) values (
					'00000000-0000-0000-0000-000000000101',
					'Legacy Customer',
					'legacy-customer@example.test',
					'test-password-hash',
					'CUSTOMER',
					'ACTIVE',
					timestamp '2026-10-01 08:00:00'
				)
				""");
		jdbcTemplate.update("""
				insert into transport_orders (id, order_code, customer_id, status, created_at)
				values
					(
						'00000000-0000-0000-0000-000000000201',
						'ORD-000009',
						'00000000-0000-0000-0000-000000000101',
						'DRAFT',
						timestamp '2026-10-01 09:00:00'
					),
					(
						'00000000-0000-0000-0000-000000000202',
						'LEGACY-CODE',
						'00000000-0000-0000-0000-000000000101',
						'DRAFT',
						timestamp '2026-10-01 10:00:00'
					)
				""");
		jdbcTemplate.update("""
				insert into payments (
					id, transport_order_id, payment_type, amount, currency, status, created_at
				) values (
					'00000000-0000-0000-0000-000000000301',
					'00000000-0000-0000-0000-000000000201',
					'DEPOSIT',
					100.00,
					'USD',
					'REFUNDED',
					timestamp '2026-10-01 11:00:00'
				)
				""");
		jdbcTemplate.update("""
				insert into deposit_refunds (
					id, payment_id, idempotency_key, provider_status, requested_at,
					completed_at, processing_error, retry_count, next_attempt_at
				) values (
					?::uuid,
					'00000000-0000-0000-0000-000000000301',
					'legacy-refund-key',
					'FAILED',
					timestamp '2026-10-01 12:00:00',
					timestamp '2026-10-01 13:00:00',
					'legacy retry state',
					4,
					?::timestamp
				)
				""", REFUND_ID, NEXT_ATTEMPT_AT);
	}
}
