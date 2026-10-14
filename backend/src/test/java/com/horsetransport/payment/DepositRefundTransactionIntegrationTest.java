package com.horsetransport.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

import com.horsetransport.notification.NotificationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest(properties = {
		"app.security.jwt.secret=01234567890123456789012345678901",
		"app.payments.refund-scan-interval-ms=3600000",
		"spring.jpa.hibernate.ddl-auto=validate"
})
class DepositRefundTransactionIntegrationTest {

	@Container
	private static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@DynamicPropertySource
	static void postgresProperties(DynamicPropertyRegistry registry) {
		registry.add("spring.datasource.url", postgres::getJdbcUrl);
		registry.add("spring.datasource.username", postgres::getUsername);
		registry.add("spring.datasource.password", postgres::getPassword);
	}

	@Autowired private JdbcTemplate jdbcTemplate;
	@Autowired private DepositRefundService service;
	@Autowired private DepositRefundProcessor processor;
	@MockitoBean private StripePaymentGateway stripe;
	@MockitoSpyBean private NotificationService notifications;

	@BeforeEach
	void cleanDatabase() {
		deleteFixtures();
	}

	@AfterEach
	void removeFixtures() {
		deleteFixtures();
	}

	@Test
	void schedulerPathUsesProxyTransactionAndDoesNotDuplicateCompletedRefund() {
		RefundFixture fixture = insertDueRefund();
		AtomicBoolean stripeCalledInTransaction = new AtomicBoolean();
		AtomicBoolean notificationCalledInTransaction = new AtomicBoolean();
		when(stripe.createRefund(any())).thenAnswer(invocation -> {
			stripeCalledInTransaction.set(TransactionSynchronizationManager.isActualTransactionActive());
			return new StripeRefundResult("re_integration", "pi_integration", 25000L, "usd", "succeeded");
		});
		doAnswer(invocation -> {
			notificationCalledInTransaction.set(TransactionSynchronizationManager.isActualTransactionActive());
			return invocation.callRealMethod();
		}).when(notifications).createRefundResult(any(), any(), any(), eq(true));

		assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
		assertThat(service.processDueRefunds()).isEqualTo(1);

		assertThat(stripeCalledInTransaction).isTrue();
		assertThat(notificationCalledInTransaction).isTrue();
		assertThat(jdbcTemplate.queryForObject("select status::text from payments where id = ?",
				String.class, fixture.paymentId())).isEqualTo("REFUNDED");
		assertThat(jdbcTemplate.queryForObject("select provider_status from deposit_refunds where id = ?",
				String.class, fixture.refundId())).isEqualTo("succeeded");
		assertThat(jdbcTemplate.queryForObject("select count(*) from notifications where transport_order_id = ?",
				Integer.class, fixture.orderId())).isEqualTo(1);

		processor.processOne(fixture.refundId());

		verify(stripe, times(1)).createRefund(any());
		assertThat(jdbcTemplate.queryForObject("select count(*) from notifications where transport_order_id = ?",
				Integer.class, fixture.orderId())).isEqualTo(1);
	}

	@Test
	void notificationFailureRollsBackRefundAndIsNotClassifiedAsStripeFailure() {
		RefundFixture fixture = insertDueRefund();
		when(stripe.createRefund(any()))
				.thenReturn(new StripeRefundResult("re_integration", "pi_integration", 25000L, "usd", "succeeded"));
		doAnswer(invocation -> {
			assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
			throw new IllegalStateException("notification database unavailable");
		}).when(notifications).createRefundResult(any(), any(), any(), eq(true));

		assertThatThrownBy(() -> processor.processOne(fixture.refundId()))
				.isInstanceOf(IllegalStateException.class)
				.hasMessage("notification database unavailable");

		assertThat(jdbcTemplate.queryForObject("select status::text from payments where id = ?",
				String.class, fixture.paymentId())).isEqualTo("PAID");
		assertThat(jdbcTemplate.queryForObject("select provider_status from deposit_refunds where id = ?",
				String.class, fixture.refundId())).isNull();
		assertThat(jdbcTemplate.queryForObject("select retry_count from deposit_refunds where id = ?",
				Integer.class, fixture.refundId())).isZero();
		assertThat(jdbcTemplate.queryForObject("select count(*) from notifications where transport_order_id = ?",
				Integer.class, fixture.orderId())).isZero();
	}

	private RefundFixture insertDueRefund() {
		UUID customerId = UUID.randomUUID();
		UUID orderId = UUID.randomUUID();
		UUID paymentId = UUID.randomUUID();
		UUID attemptId = UUID.randomUUID();
		UUID refundId = UUID.randomUUID();
		jdbcTemplate.update("""
				insert into users (id, full_name, email, password_hash, role, status, created_at)
				values (?, 'Refund Customer', ?, 'test-only', cast('CUSTOMER' as user_role),
				        cast('ACTIVE' as user_status), current_timestamp)
				""", customerId, "refund-" + customerId + "@example.test");
		jdbcTemplate.update("""
				insert into transport_orders (id, order_code, customer_id, status, created_at)
				values (?, ?, ?, cast('CANCELLED' as order_status), current_timestamp)
				""", orderId, "ORD-REFUND-" + orderId.toString().substring(0, 8), customerId);
		jdbcTemplate.update("""
				insert into payments (id, transport_order_id, payment_type, amount, currency, status, paid_at, created_at)
				values (?, ?, cast('DEPOSIT' as payment_type), 250.00, 'USD', cast('PAID' as payment_status),
				        current_timestamp, current_timestamp)
				""", paymentId, orderId);
		jdbcTemplate.update("""
				insert into payment_attempts
				    (id, payment_id, attempt_no, provider_name, provider_payment_intent_id,
				     provider_checkout_session_id, idempotency_key, provider_status, initiated_at, succeeded_at)
				values (?, ?, 1, 'STRIPE', 'pi_integration', ?, ?, 'SUCCEEDED', current_timestamp, current_timestamp)
				""", attemptId, paymentId, "cs_" + attemptId, "deposit-checkout-" + paymentId + "-1");
		jdbcTemplate.update("""
				insert into deposit_refunds
				    (id, payment_id, idempotency_key, requested_at, retry_count, next_attempt_at)
				values (?, ?, ?, current_timestamp, 0, current_timestamp)
				""", refundId, paymentId, "deadline-refund-" + paymentId);
		return new RefundFixture(orderId, paymentId, refundId);
	}

	private void deleteFixtures() {
		jdbcTemplate.update("delete from notifications");
		jdbcTemplate.update("delete from payment_provider_events");
		jdbcTemplate.update("delete from deposit_refunds");
		jdbcTemplate.update("delete from payment_attempts");
		jdbcTemplate.update("delete from payments");
		jdbcTemplate.update("delete from transport_orders");
		jdbcTemplate.update("delete from users");
	}

	private record RefundFixture(UUID orderId, UUID paymentId, UUID refundId) {
	}
}
