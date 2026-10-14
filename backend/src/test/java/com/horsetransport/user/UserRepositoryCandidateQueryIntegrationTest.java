package com.horsetransport.user;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=validate")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class UserRepositoryCandidateQueryIntegrationTest {

	@Container
	private static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@DynamicPropertySource
	static void postgresProperties(DynamicPropertyRegistry registry) {
		registry.add("spring.datasource.url", postgres::getJdbcUrl);
		registry.add("spring.datasource.username", postgres::getUsername);
		registry.add("spring.datasource.password", postgres::getPassword);
	}

	@Autowired private UserRepository userRepository;
	@Autowired private JdbcTemplate jdbcTemplate;

	@Test
	void initializesRepositoryAndExecutesBothRoleSpecificCandidateQueries() {
		insertActiveStaff("ts-query@example.test", "TRANSPORT_SPECIALIST");
		insertActiveStaff("frc-query@example.test", "FLEET_ROUTE_COORDINATOR");

		assertThat(userRepository.findActiveTransportSpecialistCandidates())
				.singleElement()
				.satisfies(candidate -> {
					assertThat(candidate.email()).isEqualTo("ts-query@example.test");
					assertThat(candidate.activeOrderCount()).isZero();
				});
		assertThat(userRepository.findActiveFleetRouteCoordinatorCandidates())
				.singleElement()
				.satisfies(candidate -> {
					assertThat(candidate.email()).isEqualTo("frc-query@example.test");
					assertThat(candidate.activeOrderCount()).isZero();
				});
	}

	private void insertActiveStaff(String email, String role) {
		jdbcTemplate.update("""
				insert into users (id, full_name, email, password_hash, role, status, created_at)
				values (?, 'Query Test Staff', ?, 'not-used', cast(? as user_role), 'ACTIVE', now())
				""", UUID.randomUUID(), email, role);
	}
}
