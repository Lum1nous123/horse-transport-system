package com.horsetransport;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;

import com.horsetransport.route.AirLegExecutionRepository;
import com.horsetransport.route.RoadVehicleExecutionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=validate")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class Sprint3ExecutionRepositoryQueryIntegrationTest {

	@Container
	private static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@DynamicPropertySource
	static void postgresProperties(DynamicPropertyRegistry registry) {
		registry.add("spring.datasource.url", postgres::getJdbcUrl);
		registry.add("spring.datasource.username", postgres::getUsername);
		registry.add("spring.datasource.password", postgres::getPassword);
	}

	@Autowired private RoadVehicleExecutionRepository roadExecutionRepository;
	@Autowired private AirLegExecutionRepository airExecutionRepository;

	@Test
	void assignedQueueQueriesExecuteAgainstPostgresSchema() {
		UUID staffId = UUID.randomUUID();

		assertThat(roadExecutionRepository.findActiveAssignedToDriver(staffId)).isEmpty();
		assertThat(roadExecutionRepository.findActiveAssignedToEscort(staffId)).isEmpty();
		assertThat(airExecutionRepository.findActiveAssignedToEscort(staffId)).isEmpty();
	}
}
