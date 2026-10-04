package com.horsetransport.notification;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "notifications")
public class Notification {

	@Id
	private UUID id;

	@Column(name = "recipient_user_id", nullable = false)
	private UUID recipientUserId;

	@Column(name = "transport_order_id", nullable = false)
	private UUID transportOrderId;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(name = "notification_type", nullable = false, columnDefinition = "notification_type")
	private NotificationType notificationType;

	@Column(name = "source_event_key", nullable = false, length = 255)
	private String sourceEventKey;

	@Column(nullable = false, length = 200)
	private String title;

	@Column(nullable = false, columnDefinition = "text")
	private String message;

	@Column(name = "created_at", nullable = false)
	private LocalDateTime createdAt;

	@Column(name = "read_at")
	private LocalDateTime readAt;

	protected Notification() {
	}

	public Notification(UUID recipientUserId, UUID transportOrderId, NotificationType notificationType,
			String sourceEventKey, String title, String message, LocalDateTime createdAt) {
		this.id = UUID.randomUUID();
		this.recipientUserId = recipientUserId;
		this.transportOrderId = transportOrderId;
		this.notificationType = notificationType;
		this.sourceEventKey = sourceEventKey;
		this.title = title;
		this.message = message;
		this.createdAt = createdAt;
	}

	@PrePersist
	void prePersist() {
		if (id == null) id = UUID.randomUUID();
		if (createdAt == null) createdAt = LocalDateTime.now();
	}

	public UUID getId() { return id; }
	public UUID getRecipientUserId() { return recipientUserId; }
	public UUID getTransportOrderId() { return transportOrderId; }
	public NotificationType getNotificationType() { return notificationType; }
	public String getSourceEventKey() { return sourceEventKey; }
	public String getTitle() { return title; }
	public String getMessage() { return message; }
	public LocalDateTime getCreatedAt() { return createdAt; }
	public LocalDateTime getReadAt() { return readAt; }
}
