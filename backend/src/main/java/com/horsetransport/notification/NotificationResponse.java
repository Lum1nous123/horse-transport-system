package com.horsetransport.notification;

import java.time.LocalDateTime;
import java.util.UUID;

public record NotificationResponse(UUID id, UUID orderId, NotificationType type,
		String title, String message, LocalDateTime createdAt, LocalDateTime readAt) {

	static NotificationResponse from(Notification notification) {
		return new NotificationResponse(notification.getId(), notification.getTransportOrderId(),
				notification.getNotificationType(), notification.getTitle(), notification.getMessage(),
				notification.getCreatedAt(), notification.getReadAt());
	}
}
