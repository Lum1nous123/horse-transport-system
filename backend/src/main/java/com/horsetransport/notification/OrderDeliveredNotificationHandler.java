package com.horsetransport.notification;

import com.horsetransport.order.OrderDeliveredEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class OrderDeliveredNotificationHandler {

	private final NotificationService notificationService;

	public OrderDeliveredNotificationHandler(NotificationService notificationService) {
		this.notificationService = notificationService;
	}

	@EventListener
	public void onOrderDelivered(OrderDeliveredEvent event) {
		notificationService.createOrderDelivered(event.customerId(), event.orderId());
	}
}
