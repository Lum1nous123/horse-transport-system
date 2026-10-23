package com.horsetransport.notification;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.horsetransport.order.OrderNotFoundException;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.payment.PaymentType;
import com.horsetransport.security.CurrentUserProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {

	private final NotificationRepository notificationRepository;
	private final TransportOrderRepository orderRepository;
	private final CurrentUserProvider currentUserProvider;
	private final Clock clock;

	public NotificationService(NotificationRepository notificationRepository,
			TransportOrderRepository orderRepository, CurrentUserProvider currentUserProvider, Clock clock) {
		this.notificationRepository = notificationRepository;
		this.orderRepository = orderRepository;
		this.currentUserProvider = currentUserProvider;
		this.clock = clock;
	}

	@Transactional
	public void createRefundResult(UUID customerId, UUID orderId, String sourceEventKey, boolean succeeded) {
		String title = succeeded ? "Deposit refund completed" : "Deposit refund needs retry";
		String message = succeeded
				? "Your full Deposit refund has been completed."
				: "We could not complete your Deposit refund yet. We will retry automatically.";
		createIfAbsent(customerId, orderId, NotificationType.REFUND_RESULT,
				sourceEventKey, title, message);
	}

	@Transactional
	public void createTripStarted(UUID customerId, UUID orderId) {
		createIfAbsent(customerId, orderId, NotificationType.TRIP_STARTED,
				NotificationEventCatalog.tripStarted(orderId), "Journey started",
				"Your horse transport journey has started.");
	}

	@Transactional
	public void createCheckpointReached(UUID customerId, UUID orderId, UUID arrivalId) {
		createIfAbsent(customerId, orderId, NotificationType.CHECKPOINT_REACHED,
				NotificationEventCatalog.checkpointReached(arrivalId), "Checkpoint reached",
				"A Vehicle carrying your Horse has reached a planned checkpoint.");
	}

	@Transactional
	public void createWelfareUpdated(UUID customerId, UUID orderId, UUID evidenceId) {
		createIfAbsent(customerId, orderId, NotificationType.WELFARE_UPDATED,
				NotificationEventCatalog.welfareUpdated(evidenceId), "Welfare update available",
				"A new Horse welfare update is available for your journey.");
	}

	@Transactional
	public void createRouteLegCompleted(UUID customerId, UUID orderId, UUID routeLegId) {
		createIfAbsent(customerId, orderId, NotificationType.ROUTE_LEG_COMPLETED,
				NotificationEventCatalog.routeLegCompleted(routeLegId), "Route leg completed",
				"One RouteLeg in your horse transport journey has been completed.");
	}

	@Transactional
	public void createRoadFinalDestinationReached(UUID customerId, UUID orderId, UUID executionId) {
		createIfAbsent(customerId, orderId, NotificationType.FINAL_DESTINATION_REACHED,
				NotificationEventCatalog.roadFinalDestinationReached(executionId),
				"Final destination reached", "A ROAD Vehicle has reached its final destination.");
	}

	@Transactional
	public void createAirFinalDestinationReached(UUID customerId, UUID orderId, UUID executionId) {
		createIfAbsent(customerId, orderId, NotificationType.FINAL_DESTINATION_REACHED,
				NotificationEventCatalog.airFinalDestinationReached(executionId),
				"Final destination reached", "The AIR RouteLeg has reached its final destination.");
	}

	@Transactional
	public void createOrderDelivered(UUID customerId, UUID orderId) {
		createIfAbsent(customerId, orderId, NotificationType.ORDER_DELIVERED,
				NotificationEventCatalog.orderDelivered(orderId), "Order delivered",
				"Your Horse transport Order has been delivered.");
	}

	@Transactional
	public void createPaymentResult(UUID customerId, UUID orderId, UUID paymentId, PaymentType paymentType) {
		String paymentName = paymentType == PaymentType.DEPOSIT ? "Deposit" : "Remaining Balance";
		createIfAbsent(customerId, orderId, NotificationType.PAYMENT_RESULT,
				NotificationEventCatalog.paymentPaid(paymentId), paymentName + " payment completed",
				"Your " + paymentName + " payment has been confirmed.");
	}

	@Transactional(readOnly = true)
	public List<NotificationResponse> findCurrentCustomerOrderNotifications(UUID orderId) {
		UUID customerId = currentUserProvider.getCurrentUserId();
		orderRepository.findByIdAndCustomerId(orderId, customerId).orElseThrow(OrderNotFoundException::new);
		return notificationRepository.findAllByTransportOrderIdAndRecipientUserIdOrderByCreatedAtDescIdDesc(
				orderId, customerId).stream().map(NotificationResponse::from).toList();
	}

	private void createIfAbsent(UUID customerId, UUID orderId, NotificationType type,
			String sourceEventKey, String title, String message) {
		if (notificationRepository.existsByRecipientUserIdAndSourceEventKey(customerId, sourceEventKey)) return;
		notificationRepository.saveAndFlush(new Notification(customerId, orderId,
				type, sourceEventKey, title, message, LocalDateTime.now(clock)));
	}
}
