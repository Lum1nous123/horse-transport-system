package com.horsetransport.payment;

import java.math.BigDecimal;
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

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "payments")
public class Payment {

	@Id
	private UUID id;

	@Column(name = "transport_order_id", nullable = false)
	private UUID transportOrderId;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(name = "payment_type", nullable = false, columnDefinition = "payment_type")
	private PaymentType paymentType;

	@Column(nullable = false, precision = 12, scale = 2)
	private BigDecimal amount;

	@Column(nullable = false, length = 10)
	private String currency;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(nullable = false, columnDefinition = "payment_status")
	private PaymentStatus status;

	@Column(name = "paid_at")
	private LocalDateTime paidAt;

	@Column(name = "refunded_at")
	private LocalDateTime refundedAt;

	@Column(name = "created_at", nullable = false)
	private LocalDateTime createdAt;

	@Column(name = "updated_at")
	private LocalDateTime updatedAt;

	protected Payment() {
	}

	Payment(UUID transportOrderId, BigDecimal amount, String currency) {
		this.id = UUID.randomUUID();
		this.transportOrderId = transportOrderId;
		this.paymentType = PaymentType.DEPOSIT;
		this.amount = amount;
		this.currency = currency;
		this.status = PaymentStatus.PENDING;
		this.createdAt = LocalDateTime.now();
	}

	@PrePersist
	void prePersist() {
		if (id == null) id = UUID.randomUUID();
		if (status == null) status = PaymentStatus.PENDING;
		if (createdAt == null) createdAt = LocalDateTime.now();
	}

	@PreUpdate
	void preUpdate() {
		updatedAt = LocalDateTime.now();
	}

	void markPaid() {
		if (status != PaymentStatus.PENDING) {
			throw new DepositPaymentConflictException("Deposit payment is not pending");
		}
		status = PaymentStatus.PAID;
		paidAt = LocalDateTime.now();
	}

	void restorePendingAfterApprovalFailure() {
		if (status == PaymentStatus.PAID) {
			status = PaymentStatus.PENDING;
			paidAt = null;
		}
	}

	public UUID getId() { return id; }
	public UUID getTransportOrderId() { return transportOrderId; }
	public PaymentType getPaymentType() { return paymentType; }
	public BigDecimal getAmount() { return amount; }
	public String getCurrency() { return currency; }
	public PaymentStatus getStatus() { return status; }
	public LocalDateTime getPaidAt() { return paidAt; }
	public LocalDateTime getRefundedAt() { return refundedAt; }
	public LocalDateTime getCreatedAt() { return createdAt; }
	public LocalDateTime getUpdatedAt() { return updatedAt; }
}
