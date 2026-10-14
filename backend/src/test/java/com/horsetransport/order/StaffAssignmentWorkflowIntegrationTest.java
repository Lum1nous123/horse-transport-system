package com.horsetransport.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import com.horsetransport.config.DemoStaffSeeder;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = {
		"app.security.jwt.secret=01234567890123456789012345678901",
		"app.payments.refund-scan-interval-ms=3600000",
		"app.document-deadline.scan-interval-ms=3600000",
		"spring.jpa.hibernate.ddl-auto=validate"
})
@AutoConfigureMockMvc
class StaffAssignmentWorkflowIntegrationTest {

	@Container
	private static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@DynamicPropertySource
	static void postgresProperties(DynamicPropertyRegistry registry) {
		registry.add("spring.datasource.url", postgres::getJdbcUrl);
		registry.add("spring.datasource.username", postgres::getUsername);
		registry.add("spring.datasource.password", postgres::getPassword);
	}

	@Autowired private MockMvc mockMvc;
	@Autowired private JdbcTemplate jdbcTemplate;
	@Autowired private PasswordEncoder passwordEncoder;
	@Autowired private DemoStaffSeeder demoStaffSeeder;
	@Autowired private UserRepository userRepository;

	private final String sharedPassword = "integration-" + UUID.randomUUID();
	private UUID logisticsManagerId;
	private UUID customerId;
	private UUID orderId;
	private UUID candidateOrderId;

	@BeforeEach
	void setUp() {
		cleanDatabase();
		assertThat(demoStaffSeeder.seed(sharedPassword).created()).isEqualTo(8);
		assertThat(demoStaffSeeder.seed(sharedPassword).existing()).isEqualTo(8);

		logisticsManagerId = insertUser("Demo Logistics Manager", "lm.integration@example.test",
				UserRole.LOGISTICS_MANAGER, sharedPassword);
		customerId = insertUser("Demo Customer", "customer.integration@example.test",
				UserRole.CUSTOMER, sharedPassword);
		orderId = insertApprovedOrder("ORD-INTEGRATION-1");
		candidateOrderId = insertApprovedOrder("ORD-INTEGRATION-2");
	}

	@AfterEach
	void tearDown() {
		cleanDatabase();
	}

	@Test
	void lmAssignmentPersistsAndAuthenticatedAssignedStaffSeeOnlyTheirActionableOrder() throws Exception {
		UUID tsId = userRepository.findByEmailIgnoreCase("alex.carter.ts@demo.horsetransport.local")
				.orElseThrow().getId();
		UUID frcId = userRepository.findByEmailIgnoreCase("jordan.ellis.frc@demo.horsetransport.local")
				.orElseThrow().getId();
		String lmToken = login("lm.integration@example.test");
		mockMvc.perform(get("/api/v1/orders/assignment-inbox")
				.queryParam("state", "NEEDS_ASSIGNMENT")
				.header(HttpHeaders.AUTHORIZATION, lmToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2));

		mockMvc.perform(get("/api/v1/orders/{id}/assignment-candidates", orderId)
				.queryParam("role", "TRANSPORT_SPECIALIST")
				.header(HttpHeaders.AUTHORIZATION, lmToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].role").value("TRANSPORT_SPECIALIST"))
				.andExpect(jsonPath("$[0].email").isNotEmpty());

		mockMvc.perform(post("/api/v1/orders/{id}/staff-assignments", orderId)
				.header(HttpHeaders.AUTHORIZATION, lmToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"transportSpecialistId":"%s","fleetRouteCoordinatorId":"%s"}
						""".formatted(tsId, frcId)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.length()").value(2));

		assertThat(jdbcTemplate.queryForObject(
				"select count(*) from order_staff_assignments where transport_order_id = ?",
				Integer.class, orderId)).isEqualTo(2);

		mockMvc.perform(get("/api/v1/orders/assignment-inbox")
				.queryParam("state", "ASSIGNED")
				.header(HttpHeaders.AUTHORIZATION, lmToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].id").value(orderId.toString()));

		String tsToken = login("alex.carter.ts@demo.horsetransport.local");
		mockMvc.perform(get("/api/v1/orders/document-inbox")
				.header(HttpHeaders.AUTHORIZATION, tsToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].id").value(orderId.toString()));

		jdbcTemplate.update("""
				update transport_orders
				set documents_final_confirmed_by = ?, documents_final_confirmed_at = current_timestamp,
				    documents_locked_at = current_timestamp
				where id = ?
				""", tsId, orderId);
		mockMvc.perform(get("/api/v1/orders/document-inbox")
				.header(HttpHeaders.AUTHORIZATION, tsToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].id").value(orderId.toString()));

		String frcToken = login("jordan.ellis.frc@demo.horsetransport.local");
		mockMvc.perform(get("/api/v1/frc/planning-queue")
				.header(HttpHeaders.AUTHORIZATION, frcToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(0));

		insertRemainingBalancePayment(orderId);
		mockMvc.perform(get("/api/v1/frc/planning-queue")
				.header(HttpHeaders.AUTHORIZATION, frcToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].orderId").value(orderId.toString()));

		assertThat(candidateCount(lmToken, candidateOrderId, "TRANSPORT_SPECIALIST", tsId)).isEqualTo(1);
		assertThat(candidateCount(lmToken, candidateOrderId, "FLEET_ROUTE_COORDINATOR", frcId)).isEqualTo(1);

		assertThat(candidateCount(lmToken, candidateOrderId, "TRANSPORT_SPECIALIST", tsId)).isZero();

		jdbcTemplate.update("""
				insert into route_plans (id, transport_order_id, status, created_by, created_at, locked_at, approved_at)
				values (?, ?, cast('APPROVED' as route_plan_status), ?, current_timestamp, current_timestamp, current_timestamp)
				""", UUID.randomUUID(), orderId, frcId);
		assertThat(candidateCount(lmToken, candidateOrderId, "FLEET_ROUTE_COORDINATOR", frcId)).isZero();
	}

	private int candidateCount(String lmToken, UUID assignableOrderId, String role, UUID userId) throws Exception {
		String body = mockMvc.perform(get("/api/v1/orders/{id}/assignment-candidates", assignableOrderId)
				.queryParam("role", role)
				.header(HttpHeaders.AUTHORIZATION, lmToken))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
		Number count = JsonPath.read(body, "$[?(@.id == '" + userId + "')].activeOrderCount[0]");
		return count.intValue();
	}

	private String login(String email) throws Exception {
		String body = mockMvc.perform(post("/api/v1/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"email":"%s","password":"%s"}
						""".formatted(email, sharedPassword)))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
		String token = JsonPath.read(body, "$.accessToken");
		return "Bearer " + token;
	}

	private UUID insertUser(String fullName, String email, UserRole role, String password) {
		UUID id = UUID.randomUUID();
		jdbcTemplate.update("""
				insert into users (id, full_name, email, password_hash, role, status, created_at)
				values (?, ?, ?, ?, cast(? as user_role), cast('ACTIVE' as user_status), current_timestamp)
				""", id, fullName, email, passwordEncoder.encode(password), role.name());
		return id;
	}

	private UUID insertApprovedOrder(String orderCode) {
		UUID id = UUID.randomUUID();
		jdbcTemplate.update("""
				insert into transport_orders
				(id, order_code, customer_id, origin_address, origin_country, destination_address,
				 destination_country, requested_departure_at, transport_mode, recipient_name,
				 recipient_phone, status, approved_at, created_at)
				values (?, ?, ?, 'Hanoi', 'Vietnam', 'Bangkok', 'Thailand', current_timestamp + interval '7 days',
				        cast('ROAD' as transport_mode), 'Recipient', '0900000000',
				        cast('APPROVED' as order_status), current_timestamp, current_timestamp)
				""", id, orderCode, customerId);
		return id;
	}

	private void insertRemainingBalancePayment(UUID transportOrderId) {
		jdbcTemplate.update("""
				insert into payments (id, transport_order_id, payment_type, amount, currency, status, paid_at, created_at)
				values (?, ?, cast('REMAINING_BALANCE' as payment_type), 100.00, 'USD',
				        cast('PAID' as payment_status), current_timestamp, current_timestamp)
				""", UUID.randomUUID(), transportOrderId);
	}

	private void cleanDatabase() {
		jdbcTemplate.update("delete from route_plans");
		jdbcTemplate.update("delete from payments");
		jdbcTemplate.update("delete from order_staff_assignments");
		jdbcTemplate.update("delete from transport_orders");
		jdbcTemplate.update("delete from users");
	}
}
