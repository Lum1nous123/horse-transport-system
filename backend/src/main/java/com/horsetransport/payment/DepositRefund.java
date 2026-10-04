package com.horsetransport.payment;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "deposit_refunds")
public class DepositRefund {

	@Id
	private UUID id;

	@Column(name = "payment_id", nullable = false, unique = true)
	private UUID paymentId;

	@Column(name = "provider_refund_id", unique = true, length = 255)
	private String providerRefundId;

	@Column(name = "idempotency_key", nullable = false, unique = true, length = 255)
	private String idempotencyKey;

	@Column(name = "provider_status", length = 80)
	private String providerStatus;

	@Column(name = "requested_at", nullable = false)
	private LocalDateTime requestedAt;

	@Column(name = "completed_at")
	private LocalDateTime completedAt;

	@Column(name = "processing_error", columnDefinition = "text")
	private String processingError;

	@Column(name = "retry_count", nullable = false)
	private int retryCount;

	@Column(name = "next_attempt_at")
	private LocalDateTime nextAttemptAt;

	protected DepositRefund() {
	}

	public DepositRefund(UUID paymentId, String idempotencyKey, LocalDateTime requestedAt) {
		this.id = UUID.randomUUID();
		this.paymentId = paymentId;
		this.idempotencyKey = idempotencyKey;
		this.requestedAt = requestedAt;
	}

	@PrePersist
	void prePersist() {
		if (id == null) id = UUID.randomUUID();
	}

	public UUID getId() { return id; }
	public UUID getPaymentId() { return paymentId; }
	public String getProviderRefundId() { return providerRefundId; }
	public String getIdempotencyKey() { return idempotencyKey; }
	public String getProviderStatus() { return providerStatus; }
	public LocalDateTime getRequestedAt() { return requestedAt; }
	public LocalDateTime getCompletedAt() { return completedAt; }
	public String getProcessingError() { return processingError; }
	public int getRetryCount() { return retryCount; }
	public LocalDateTime getNextAttemptAt() { return nextAttemptAt; }

	void markProcessing() { retryCount++; providerStatus = "processing"; nextAttemptAt = null; processingError = null; }
	void recordFailure(String message, LocalDateTime retryAt) {
		providerStatus = "FAILED"; processingError = message; nextAttemptAt = retryAt;
	}
	void recordProviderResult(String refundId, String status) {
		providerRefundId = refundId; providerStatus = status;
		if ("succeeded".equals(status)) { processingError = null; nextAttemptAt = null; }
	}
	void markCompletedAt(LocalDateTime at) { completedAt = at; processingError = null; nextAttemptAt = null; }
	void recordProviderFailure(String refundId, String message, LocalDateTime retryAt) {
		providerRefundId = refundId; recordFailure(message, retryAt);
	}
	void recordPending(LocalDateTime retryAt) {
		providerStatus = "pending"; nextAttemptAt = retryAt; processingError = null;
	}
	void rotateIdempotencyKey(String key) { idempotencyKey = key; providerRefundId = null; completedAt = null; }
}
