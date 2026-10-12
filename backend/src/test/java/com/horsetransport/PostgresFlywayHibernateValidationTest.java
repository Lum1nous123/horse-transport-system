package com.horsetransport;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = {
		"app.security.jwt.secret=01234567890123456789012345678901",
		"spring.jpa.hibernate.ddl-auto=validate"
})
class PostgresFlywayHibernateValidationTest {

	@Container
	private static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@DynamicPropertySource
	static void postgresProperties(DynamicPropertyRegistry registry) {
		registry.add("spring.datasource.url", postgres::getJdbcUrl);
		registry.add("spring.datasource.username", postgres::getUsername);
		registry.add("spring.datasource.password", postgres::getPassword);
	}

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Test
	void flywayMigrationsSupportHibernateSchemaValidationOnPostgres() {
		Integer frcEligibleColumns = jdbcTemplate.queryForObject("""
				select count(*)
				from information_schema.columns
				where table_schema = 'public'
					and table_name = 'transport_orders'
					and column_name = 'frc_eligible'
				""", Integer.class);

		assertThat(frcEligibleColumns).isZero();
	}
}
