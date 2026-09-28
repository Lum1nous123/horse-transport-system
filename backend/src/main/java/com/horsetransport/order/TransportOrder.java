package com.horsetransport.order;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "transport_orders")
public class TransportOrder {

	@Id
	private UUID id;

	@Column(name = "order_code", nullable = false, unique = true, length = 30)
	private String orderCode;

	@Column(name = "customer_id", nullable = false)
	private UUID customerId;

	@Column(name = "origin_address", length = 255)
	private String originAddress;

	@Column(name = "origin_country", length = 100)
	private String originCountry;

	@Column(name = "destination_address", length = 255)
	private String destinationAddress;

	@Column(name = "destination_country", length = 100)
	private String destinationCountry;

	@Column(name = "requested_departure_at")
	private LocalDateTime requestedDepartureAt;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(name = "transport_mode", columnDefinition = "transport_mode")
	private TransportMode transportMode;

	@Column(name = "special_requirements", columnDefinition = "text")
	private String specialRequirements;

	@Column(name = "recipient_name", length = 150)
	private String recipientName;

	@Column(name = "recipient_phone", length = 30)
	private String recipientPhone;

	@Column(name = "recipient_email", length = 150)
	private String recipientEmail;

	@Column(name = "rejection_reason", columnDefinition = "text")
	private String rejectionReason;

	@Column(name = "cancellation_reason", columnDefinition = "text")
	private String cancellationReason;

	@Column(name = "cancelled_at")
	private LocalDateTime cancelledAt;

	@Column(name = "approved_at")
	private LocalDateTime approvedAt;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(nullable = false, columnDefinition = "order_status")
	private OrderStatus status;

	@Column(name = "created_at", nullable = false)
	private LocalDateTime createdAt;

	@Column(name = "updated_at")
	private LocalDateTime updatedAt;

	@OneToMany(mappedBy = "transportOrder", cascade = CascadeType.ALL, orphanRemoval = true)
	private List<TransportOrderHorse> horses = new ArrayList<>();

	protected TransportOrder() {
	}

	TransportOrder(UUID customerId, String orderCode) {
		this.id = UUID.randomUUID();
		this.customerId = customerId;
		this.orderCode = orderCode;
		this.status = OrderStatus.DRAFT;
		this.createdAt = LocalDateTime.now();
	}

	@PrePersist
	void prePersist() {
		if (id == null) {
			id = UUID.randomUUID();
		}
		if (status == null) {
			status = OrderStatus.DRAFT;
		}
		if (createdAt == null) {
			createdAt = LocalDateTime.now();
		}
	}

	@PreUpdate
	void preUpdate() {
		updatedAt = LocalDateTime.now();
	}

	void update(UpdateOrderRequest request, Collection<UUID> horseIds) {
		originAddress = normalize(request.originAddress());
		originCountry = normalize(request.originCountry());
		destinationAddress = normalize(request.destinationAddress());
		destinationCountry = normalize(request.destinationCountry());
		requestedDepartureAt = request.requestedDepartureAt();
		transportMode = request.transportMode();
		specialRequirements = normalize(request.specialRequirements());
		recipientName = normalize(request.recipientName());
		recipientPhone = normalize(request.recipientPhone());
		recipientEmail = normalize(request.recipientEmail());
		Set<UUID> requestedHorseIds = new HashSet<>(horseIds);
		horses.removeIf(orderHorse -> !requestedHorseIds.contains(orderHorse.getHorseId()));
		Set<UUID> existingHorseIds = new HashSet<>(horses.stream()
				.map(TransportOrderHorse::getHorseId).toList());
		horseIds.stream()
				.filter(horseId -> !existingHorseIds.contains(horseId))
				.forEach(horseId -> horses.add(new TransportOrderHorse(this, horseId)));
	}

	void submit() {
		status = OrderStatus.SUBMITTED;
	}

	void cancel() {
		status = OrderStatus.CANCELLED;
		cancellationReason = null;
		cancelledAt = LocalDateTime.now();
	}

	void reject(String reason) {
		status = OrderStatus.REJECTED;
		rejectionReason = reason.trim();
	}

	public void markQuotationSent() {
		if (status != OrderStatus.SUBMITTED) {
			throw new InvalidOrderTransitionException(status, "quoted");
		}
		status = OrderStatus.QUOTATION_SENT;
	}

	public void restoreSubmittedAfterQuotationSendFailure() {
		if (status == OrderStatus.QUOTATION_SENT) {
			status = OrderStatus.SUBMITTED;
		}
	}

	public void approveAfterDeposit() {
		if (status != OrderStatus.QUOTATION_SENT) {
			throw new InvalidOrderTransitionException(status, "approved after Deposit payment");
		}
		status = OrderStatus.APPROVED;
		approvedAt = LocalDateTime.now();
	}

	public void restoreQuotationSentAfterApprovalFailure() {
		if (status == OrderStatus.APPROVED) {
			status = OrderStatus.QUOTATION_SENT;
			approvedAt = null;
		}
	}

	void restoreDraft() {
		status = OrderStatus.DRAFT;
	}

	void restoreTransition(OrderStatus previousStatus, String previousRejectionReason,
			String previousCancellationReason, LocalDateTime previousCancelledAt) {
		status = previousStatus;
		rejectionReason = previousRejectionReason;
		cancellationReason = previousCancellationReason;
		cancelledAt = previousCancelledAt;
	}

	private String normalize(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}

	public UUID getId() { return id; }
	public String getOrderCode() { return orderCode; }
	public UUID getCustomerId() { return customerId; }
	public String getOriginAddress() { return originAddress; }
	public String getOriginCountry() { return originCountry; }
	public String getDestinationAddress() { return destinationAddress; }
	public String getDestinationCountry() { return destinationCountry; }
	public LocalDateTime getRequestedDepartureAt() { return requestedDepartureAt; }
	public TransportMode getTransportMode() { return transportMode; }
	public String getSpecialRequirements() { return specialRequirements; }
	public String getRecipientName() { return recipientName; }
	public String getRecipientPhone() { return recipientPhone; }
	public String getRecipientEmail() { return recipientEmail; }
	public String getRejectionReason() { return rejectionReason; }
	public String getCancellationReason() { return cancellationReason; }
	public LocalDateTime getCancelledAt() { return cancelledAt; }
	public LocalDateTime getApprovedAt() { return approvedAt; }
	public OrderStatus getStatus() { return status; }
	public LocalDateTime getCreatedAt() { return createdAt; }
	public LocalDateTime getUpdatedAt() { return updatedAt; }
	public List<TransportOrderHorse> getHorses() { return List.copyOf(horses); }
}
