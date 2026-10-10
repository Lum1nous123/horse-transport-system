package com.horsetransport.payment;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "payment_attempts")
public class PaymentAttempt {

	private static final String PROVIDER_STRIPE = "STRIPE";

	@Id
	private UUID id;

	@Column(name = "payment_id", nullable = false)
	private UUID paymentId;

	@Column(name = "attempt_no", nullable = false)
	private int attemptNo;

	@Column(name = "provider_name", nullable = false, length = 30)
	private String providerName;

	@Column(name = "provider_payment_intent_id", unique = true, length = 255)
	private String providerPaymentIntentId;

	@Column(name = "provider_checkout_session_id", unique = true, length = 255)
	private String providerCheckoutSessionId;

	@Column(name = "idempotency_key", nullable = false, unique = true, length = 255)
	private String idempotencyKey;

	@Enumerated(EnumType.STRING)
	@Column(name = "provider_status", length = 80)
	private PaymentAttemptStatus providerStatus;

	@Column(name = "initiated_at", nullable = false)
	private LocalDateTime initiatedAt;

	@Column(name = "succeeded_at")
	private LocalDateTime succeededAt;

	@Column(name = "updated_at")
	private LocalDateTime updatedAt;

	protected PaymentAttempt() {
	}

	PaymentAttempt(UUID paymentId, PaymentType paymentType, int attemptNo) {
		this.id = UUID.randomUUID();
		this.paymentId = paymentId;
		this.attemptNo = attemptNo;
		this.providerName = PROVIDER_STRIPE;
		this.idempotencyKey = paymentType.name().toLowerCase() + "-checkout-" + paymentId + "-" + attemptNo;
		this.providerStatus = PaymentAttemptStatus.PENDING;
		this.initiatedAt = LocalDateTime.now();
	}

	@PrePersist
	void prePersist() {
		if (id == null) id = UUID.randomUUID();
		if (providerName == null) providerName = PROVIDER_STRIPE;
		if (providerStatus == null) providerStatus = PaymentAttemptStatus.PENDING;
		if (initiatedAt == null) initiatedAt = LocalDateTime.now();
	}

	@PreUpdate
	void preUpdate() {
		updatedAt = LocalDateTime.now();
	}

	void attachCheckoutSession(String sessionId, String paymentIntentId) {
		providerCheckoutSessionId = sessionId;
		providerPaymentIntentId = paymentIntentId;
		providerStatus = PaymentAttemptStatus.OPEN;
	}

	void markSucceeded(String sessionId, String paymentIntentId) {
		providerCheckoutSessionId = sessionId;
		providerPaymentIntentId = paymentIntentId;
		providerStatus = PaymentAttemptStatus.SUCCEEDED;
		succeededAt = LocalDateTime.now();
	}

	void markTerminal(PaymentAttemptStatus status) {
		markTerminal(status, null, null);
	}

	void markTerminal(PaymentAttemptStatus status, String sessionId, String paymentIntentId) {
		if (status != PaymentAttemptStatus.CANCELLED && status != PaymentAttemptStatus.EXPIRED) {
			throw new IllegalArgumentException("Attempt status must be terminal");
		}
		if (sessionId != null) providerCheckoutSessionId = sessionId;
		if (paymentIntentId != null) providerPaymentIntentId = paymentIntentId;
		providerStatus = status;
	}

	void restoreAfterSuccessFailure(PaymentAttemptStatus status, String sessionId, String paymentIntentId) {
		providerStatus = status;
		providerCheckoutSessionId = sessionId;
		providerPaymentIntentId = paymentIntentId;
		succeededAt = null;
	}

	public UUID getId() { return id; }
	public UUID getPaymentId() { return paymentId; }
	public int getAttemptNo() { return attemptNo; }
	public String getProviderName() { return providerName; }
	public String getProviderPaymentIntentId() { return providerPaymentIntentId; }
	public String getProviderCheckoutSessionId() { return providerCheckoutSessionId; }
	public String getIdempotencyKey() { return idempotencyKey; }
	public PaymentAttemptStatus getProviderStatus() { return providerStatus; }
	public LocalDateTime getInitiatedAt() { return initiatedAt; }
	public LocalDateTime getSucceededAt() { return succeededAt; }
	public LocalDateTime getUpdatedAt() { return updatedAt; }
}
