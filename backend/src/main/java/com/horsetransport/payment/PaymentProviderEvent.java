package com.horsetransport.payment;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "payment_provider_events")
public class PaymentProviderEvent {

	@Id
	private UUID id;

	@Column(name = "payment_id", nullable = false)
	private UUID paymentId;

	@Column(name = "payment_attempt_id")
	private UUID paymentAttemptId;

	@Column(name = "provider_event_id", nullable = false, unique = true, length = 255)
	private String providerEventId;

	@Column(name = "provider_event_type", nullable = false, length = 120)
	private String providerEventType;

	@Column(name = "received_at", nullable = false)
	private LocalDateTime receivedAt;

	@Column(name = "processed_at")
	private LocalDateTime processedAt;

	@Column(name = "processing_error", columnDefinition = "text")
	private String processingError;

	protected PaymentProviderEvent() {
	}

	PaymentProviderEvent(UUID paymentId, UUID paymentAttemptId, String eventId, String eventType) {
		this.id = UUID.randomUUID();
		this.paymentId = paymentId;
		this.paymentAttemptId = paymentAttemptId;
		this.providerEventId = eventId;
		this.providerEventType = eventType;
		this.receivedAt = LocalDateTime.now();
	}

	@PrePersist
	void prePersist() {
		if (id == null) id = UUID.randomUUID();
		if (receivedAt == null) receivedAt = LocalDateTime.now();
	}

	void markProcessed() {
		processedAt = LocalDateTime.now();
		processingError = null;
	}

	void markRejected(String error) {
		processedAt = LocalDateTime.now();
		processingError = error;
	}

	public UUID getPaymentId() { return paymentId; }
	public UUID getPaymentAttemptId() { return paymentAttemptId; }
	public String getProviderEventId() { return providerEventId; }
	public String getProviderEventType() { return providerEventType; }
	public LocalDateTime getReceivedAt() { return receivedAt; }
	public LocalDateTime getProcessedAt() { return processedAt; }
	public String getProcessingError() { return processingError; }
}
