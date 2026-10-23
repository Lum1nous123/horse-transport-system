package com.horsetransport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.lang.reflect.Constructor;
import java.util.UUID;

import com.horsetransport.notification.NotificationEventCatalog;
import com.horsetransport.notification.NotificationRepository;
import com.horsetransport.notification.NotificationService;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
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

	@Autowired
	private Flyway flyway;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private TransportOrderRepository orderRepository;

	@Autowired
	private NotificationRepository notificationRepository;

	@Autowired
	private NotificationService notificationService;

	@Autowired
	private TransactionTemplate transactionTemplate;

	@Test
	void freshDatabaseMigratesAndSupportsHibernateSchemaValidation() {
		PostgresMigrationAssertions.assertCanonicalHistory(jdbcTemplate);
		PostgresMigrationAssertions.assertRefundSchema(jdbcTemplate);
		PostgresMigrationAssertions.assertOrderCodeSequenceExists(jdbcTemplate);
		PostgresMigrationAssertions.assertFrcEligibleColumnIsAbsent(jdbcTemplate);
		PostgresMigrationAssertions.assertProofOfDeliverySchema(jdbcTemplate);
		PostgresMigrationAssertions.assertNotificationSchema(jdbcTemplate);
		flyway.validate();
		assertThat(flyway.migrate().migrationsExecuted).isZero();

		Long firstSequenceValue = jdbcTemplate.queryForObject(
				"select nextval('transport_order_code_seq')", Long.class);
		assertThat(firstSequenceValue).isEqualTo(1L);
	}

	@Test
	void notificationRowRollsBackWithOuterBusinessTransaction() throws ReflectiveOperationException {
		String suffix = UUID.randomUUID().toString();
		UserAccount customer = userRepository.saveAndFlush(UserAccount.registerCustomer(
				"Rollback Customer", "rollback-" + suffix + "@test.local", null, "hash"));
		Constructor<TransportOrder> constructor = TransportOrder.class
				.getDeclaredConstructor(UUID.class, String.class);
		constructor.setAccessible(true);
		TransportOrder order = orderRepository.saveAndFlush(
				constructor.newInstance(customer.getId(), "ROLLBACK-" + suffix.substring(0, 8)));
		String sourceKey = NotificationEventCatalog.tripStarted(order.getId());

		assertThatThrownBy(() -> transactionTemplate.executeWithoutResult(status -> {
			notificationService.createTripStarted(customer.getId(), order.getId());
			throw new IllegalStateException("business mutation failed");
		})).isInstanceOf(IllegalStateException.class);

		assertThat(notificationRepository.existsByRecipientUserIdAndSourceEventKey(
				customer.getId(), sourceKey)).isFalse();
	}
}
