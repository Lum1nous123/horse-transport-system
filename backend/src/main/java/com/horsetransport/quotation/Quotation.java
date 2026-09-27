package com.horsetransport.quotation;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "quotations")
public class Quotation {

	public static final String CURRENCY_USD = "USD";

	@Id
	private UUID id;

	@Column(name = "transport_order_id", nullable = false, unique = true)
	private UUID transportOrderId;

	@Column(name = "total_amount", precision = 12, scale = 2)
	private BigDecimal totalAmount;

	@Column(name = "deposit_amount", precision = 12, scale = 2)
	private BigDecimal depositAmount;

	@Column(name = "remaining_amount", precision = 12, scale = 2)
	private BigDecimal remainingAmount;

	@Column(nullable = false, length = 10)
	private String currency;

	@Column(columnDefinition = "text")
	private String notes;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(nullable = false, columnDefinition = "quotation_status")
	private QuotationStatus status;

	@Column(name = "created_by", nullable = false)
	private UUID createdBy;

	@Column(name = "sent_at")
	private LocalDateTime sentAt;

	@Column(name = "created_at", nullable = false)
	private LocalDateTime createdAt;

	@Column(name = "updated_at")
	private LocalDateTime updatedAt;

	@OneToMany(mappedBy = "quotation", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("sequenceNo ASC")
	private List<QuotationLineItem> lineItems = new ArrayList<>();

	protected Quotation() {
	}

	Quotation(UUID transportOrderId, UUID createdBy) {
		this.id = UUID.randomUUID();
		this.transportOrderId = transportOrderId;
		this.createdBy = createdBy;
		this.currency = CURRENCY_USD;
		this.status = QuotationStatus.DRAFT;
		this.createdAt = LocalDateTime.now();
	}

	@PrePersist
	void prePersist() {
		if (id == null) id = UUID.randomUUID();
		if (currency == null) currency = CURRENCY_USD;
		if (status == null) status = QuotationStatus.DRAFT;
		if (createdAt == null) createdAt = LocalDateTime.now();
	}

	@PreUpdate
	void preUpdate() {
		updatedAt = LocalDateTime.now();
	}

	void replace(UpdateQuotationRequest request) {
		Map<Integer, QuotationLineItem> existingBySequence = lineItems.stream()
				.collect(Collectors.toMap(QuotationLineItem::getSequenceNo, Function.identity()));
		List<QuotationLineItem> replacements = request.safeLineItems().stream()
				.map(item -> {
					QuotationLineItem existing = existingBySequence.get(item.sequenceNo());
					if (existing != null) {
						existing.update(item);
						return existing;
					}
					return new QuotationLineItem(this, item);
				})
				.toList();
		lineItems.removeIf(item -> !replacements.contains(item));
		replacements.stream().filter(item -> !lineItems.contains(item)).forEach(lineItems::add);
		lineItems.sort(java.util.Comparator.comparingInt(QuotationLineItem::getSequenceNo));
		totalAmount = lineItems.isEmpty() ? null : lineItems.stream()
				.map(QuotationLineItem::getAmount)
				.reduce(BigDecimal.ZERO, BigDecimal::add);
		depositAmount = request.depositAmount();
		remainingAmount = depositAmount == null ? null : totalAmount.subtract(depositAmount);
		notes = normalize(request.notes());
	}

	void send() {
		status = QuotationStatus.SENT;
		sentAt = LocalDateTime.now();
	}

	void restoreDraftAfterSendFailure() {
		status = QuotationStatus.DRAFT;
		sentAt = null;
	}

	private String normalize(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}

	public UUID getId() { return id; }
	public UUID getTransportOrderId() { return transportOrderId; }
	public BigDecimal getTotalAmount() { return totalAmount; }
	public BigDecimal getDepositAmount() { return depositAmount; }
	public BigDecimal getRemainingAmount() { return remainingAmount; }
	public String getCurrency() { return currency; }
	public String getNotes() { return notes; }
	public QuotationStatus getStatus() { return status; }
	public UUID getCreatedBy() { return createdBy; }
	public LocalDateTime getSentAt() { return sentAt; }
	public LocalDateTime getCreatedAt() { return createdAt; }
	public LocalDateTime getUpdatedAt() { return updatedAt; }
	public List<QuotationLineItem> getLineItems() { return List.copyOf(lineItems); }
}
