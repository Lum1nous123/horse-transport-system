package com.horsetransport.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Constructor;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.horsetransport.order.OrderDeliveredEvent;
import com.horsetransport.order.OrderNotFoundException;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.payment.PaymentType;
import com.horsetransport.security.CurrentUserProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

	private static final UUID CUSTOMER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final UUID ORDER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
	private static final UUID PAYMENT_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
	private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-23T08:00:00Z"), ZoneOffset.UTC);

	@Mock private NotificationRepository notificationRepository;
	@Mock private TransportOrderRepository orderRepository;
	@Mock private CurrentUserProvider currentUserProvider;

	private NotificationService service;

	@BeforeEach
	void setUp() {
		service = new NotificationService(notificationRepository, orderRepository, currentUserProvider, CLOCK);
	}

	@Test
	void orderDeliveredHandlerCreatesExactlyOneCustomerNotificationOnRetry() {
		String key = NotificationEventCatalog.orderDelivered(ORDER_ID);
		when(notificationRepository.existsByRecipientUserIdAndSourceEventKey(CUSTOMER_ID, key))
				.thenReturn(false, true);
		when(notificationRepository.saveAndFlush(any(Notification.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));
		OrderDeliveredNotificationHandler handler = new OrderDeliveredNotificationHandler(service);
		OrderDeliveredEvent event = new OrderDeliveredEvent(ORDER_ID, CUSTOMER_ID, UUID.randomUUID(),
				java.time.LocalDateTime.of(2026, 10, 23, 15, 0));

		handler.onOrderDelivered(event);
		handler.onOrderDelivered(event);

		ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
		verify(notificationRepository).saveAndFlush(captor.capture());
		Notification saved = captor.getValue();
		assertThat(saved.getRecipientUserId()).isEqualTo(CUSTOMER_ID);
		assertThat(saved.getTransportOrderId()).isEqualTo(ORDER_ID);
		assertThat(saved.getNotificationType()).isEqualTo(NotificationType.ORDER_DELIVERED);
		assertThat(saved.getSourceEventKey()).isEqualTo(key);
	}

	@Test
	void paymentResultUsesLogicalPaymentKeyAndIsIdempotent() {
		String key = NotificationEventCatalog.paymentPaid(PAYMENT_ID);
		when(notificationRepository.existsByRecipientUserIdAndSourceEventKey(CUSTOMER_ID, key))
				.thenReturn(false, true);
		when(notificationRepository.saveAndFlush(any(Notification.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		service.createPaymentResult(CUSTOMER_ID, ORDER_ID, PAYMENT_ID, PaymentType.REMAINING_BALANCE);
		service.createPaymentResult(CUSTOMER_ID, ORDER_ID, PAYMENT_ID, PaymentType.REMAINING_BALANCE);

		ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
		verify(notificationRepository).saveAndFlush(captor.capture());
		assertThat(captor.getValue().getNotificationType()).isEqualTo(NotificationType.PAYMENT_RESULT);
		assertThat(captor.getValue().getSourceEventKey()).isEqualTo(key);
	}

	@Test
	void existingRefundKeyAndMessagesRemainUnchanged() {
		UUID refundId = UUID.randomUUID();
		String key = "refund-" + refundId + "-success";
		when(notificationRepository.existsByRecipientUserIdAndSourceEventKey(CUSTOMER_ID, key))
				.thenReturn(false);
		when(notificationRepository.saveAndFlush(any(Notification.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		service.createRefundResult(CUSTOMER_ID, ORDER_ID, key, true);

		ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
		verify(notificationRepository).saveAndFlush(captor.capture());
		assertThat(captor.getValue().getSourceEventKey()).isEqualTo(key);
		assertThat(captor.getValue().getTitle()).isEqualTo("Deposit refund completed");
		assertThat(captor.getValue().getMessage()).isEqualTo("Your full Deposit refund has been completed.");
	}

	@Test
	void notificationEndpointServiceRequiresCustomerOwnership() {
		when(currentUserProvider.getCurrentUserId()).thenReturn(CUSTOMER_ID);
		when(orderRepository.findByIdAndCustomerId(ORDER_ID, CUSTOMER_ID)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.findCurrentCustomerOrderNotifications(ORDER_ID))
				.isInstanceOf(OrderNotFoundException.class);
		verify(notificationRepository, never())
				.findAllByTransportOrderIdAndRecipientUserIdOrderByCreatedAtDescIdDesc(any(), any());
	}

	@Test
	void ownerReadsOnlyOwnOrderNotifications() {
		when(currentUserProvider.getCurrentUserId()).thenReturn(CUSTOMER_ID);
		when(orderRepository.findByIdAndCustomerId(ORDER_ID, CUSTOMER_ID))
				.thenReturn(Optional.of(order()));
		when(notificationRepository.findAllByTransportOrderIdAndRecipientUserIdOrderByCreatedAtDescIdDesc(
				ORDER_ID, CUSTOMER_ID)).thenReturn(List.of());

		assertThat(service.findCurrentCustomerOrderNotifications(ORDER_ID)).isEmpty();
	}

	@Test
	void outerTransactionRollbackDoesNotCommitCreatedNotification() {
		List<Notification> committed = new ArrayList<>();
		String key = NotificationEventCatalog.tripStarted(ORDER_ID);
		when(notificationRepository.existsByRecipientUserIdAndSourceEventKey(CUSTOMER_ID, key))
				.thenReturn(false);
		when(notificationRepository.saveAndFlush(any(Notification.class))).thenAnswer(invocation -> {
			Notification pending = invocation.getArgument(0);
			TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
				@Override
				public void afterCommit() {
					committed.add(pending);
				}
			});
			return pending;
		});
		TransactionTemplate transaction = new TransactionTemplate(new TestTransactionManager());

		assertThatThrownBy(() -> transaction.executeWithoutResult(status -> {
			service.createTripStarted(CUSTOMER_ID, ORDER_ID);
			throw new IllegalStateException("business mutation failed");
		})).isInstanceOf(IllegalStateException.class);

		assertThat(committed).isEmpty();
	}

	private TransportOrder order() {
		try {
			Constructor<TransportOrder> constructor = TransportOrder.class
					.getDeclaredConstructor(UUID.class, String.class);
			constructor.setAccessible(true);
			return constructor.newInstance(CUSTOMER_ID, "ORD-NOTIFICATION");
		} catch (ReflectiveOperationException exception) {
			throw new IllegalStateException(exception);
		}
	}

	private static final class TestTransactionManager extends AbstractPlatformTransactionManager {
		@Override
		protected Object doGetTransaction() {
			return new Object();
		}

		@Override
		protected void doBegin(Object transaction, TransactionDefinition definition) {
		}

		@Override
		protected void doCommit(DefaultTransactionStatus status) {
		}

		@Override
		protected void doRollback(DefaultTransactionStatus status) {
		}
	}
}
