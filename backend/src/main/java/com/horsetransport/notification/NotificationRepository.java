package com.horsetransport.notification;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

	boolean existsByRecipientUserIdAndSourceEventKey(UUID recipientUserId, String sourceEventKey);

	List<Notification> findAllByTransportOrderIdAndRecipientUserIdOrderByCreatedAtDescIdDesc(
			UUID transportOrderId, UUID recipientUserId);
}
