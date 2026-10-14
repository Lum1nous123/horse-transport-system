package com.horsetransport;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;

import com.horsetransport.order.OrderStaffAssignmentRepository;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.payment.PaymentRepository;
import com.horsetransport.payment.PaymentType;
import com.horsetransport.route.AirLegExecutionRepository;
import com.horsetransport.route.ExecutionStatus;
import com.horsetransport.route.RoadVehicleExecutionRepository;
import com.horsetransport.route.RoutePlanReviewDecision;
import com.horsetransport.route.RoutePlanReviewRepository;
import com.horsetransport.user.UserRepository;
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
class Sprint2EnumRepositoryQueryIntegrationTest {

	@Container
	private static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@DynamicPropertySource
	static void postgresProperties(DynamicPropertyRegistry registry) {
		registry.add("spring.datasource.url", postgres::getJdbcUrl);
		registry.add("spring.datasource.username", postgres::getUsername);
		registry.add("spring.datasource.password", postgres::getPassword);
	}

	@Autowired private UserRepository userRepository;
	@Autowired private OrderStaffAssignmentRepository assignmentRepository;
	@Autowired private PaymentRepository paymentRepository;
	@Autowired private RoutePlanReviewRepository routePlanReviewRepository;
	@Autowired private RoadVehicleExecutionRepository roadExecutionRepository;
	@Autowired private AirLegExecutionRepository airExecutionRepository;

	@Test
	void executesSprintTwoQueriesThatBindOrInlinePostgresEnums() {
		assertThat(userRepository.findActiveTransportSpecialistCandidates()).isEmpty();
		assertThat(userRepository.findActiveFleetRouteCoordinatorCandidates()).isEmpty();
		assertThat(assignmentRepository.findUnassignedOrdersByStatus(OrderStatus.APPROVED)).isEmpty();
		assertThat(assignmentRepository.findAssignedNonTerminalOrders(List.of(
				OrderStatus.DELIVERED, OrderStatus.REJECTED, OrderStatus.CANCELLED))).isEmpty();
		assertThat(paymentRepository.findByTransportOrderIdAndPaymentType(
				UUID.randomUUID(), PaymentType.REMAINING_BALANCE)).isEmpty();
		assertThat(routePlanReviewRepository.findAllByDecisionOrderBySubmittedAtAsc(
				RoutePlanReviewDecision.PENDING)).isEmpty();
		assertThat(roadExecutionRepository.countByDriverIdAndStatusIn(
				UUID.randomUUID(), List.of(ExecutionStatus.NOT_STARTED))).isZero();
		assertThat(airExecutionRepository.countByEscortIdAndStatusIn(
				UUID.randomUUID(), List.of(ExecutionStatus.NOT_STARTED))).isZero();
	}
}
