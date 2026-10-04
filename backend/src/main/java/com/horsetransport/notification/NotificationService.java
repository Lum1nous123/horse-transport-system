package com.horsetransport.notification;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.horsetransport.order.OrderNotFoundException;
import com.horsetransport.order.TransportOrderRepository;
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
		if (notificationRepository.existsByRecipientUserIdAndSourceEventKey(customerId, sourceEventKey)) return;
		String title = succeeded ? "Deposit refund completed" : "Deposit refund needs retry";
		String message = succeeded
				? "Your full Deposit refund has been completed."
				: "We could not complete your Deposit refund yet. We will retry automatically.";
		notificationRepository.saveAndFlush(new Notification(customerId, orderId,
				NotificationType.REFUND_RESULT, sourceEventKey, title, message, LocalDateTime.now(clock)));
	}

	@Transactional(readOnly = true)
	public List<NotificationResponse> findCurrentCustomerOrderNotifications(UUID orderId) {
		UUID customerId = currentUserProvider.getCurrentUserId();
		orderRepository.findByIdAndCustomerId(orderId, customerId).orElseThrow(OrderNotFoundException::new);
		return notificationRepository.findAllByTransportOrderIdAndRecipientUserIdOrderByCreatedAtDescIdDesc(
				orderId, customerId).stream().map(NotificationResponse::from).toList();
	}
}
