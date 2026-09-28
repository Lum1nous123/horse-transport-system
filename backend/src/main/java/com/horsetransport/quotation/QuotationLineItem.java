package com.horsetransport.quotation;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "quotation_line_items")
public class QuotationLineItem {

	@Id
	private UUID id;

	@ManyToOne(optional = false)
	private Quotation quotation;

	@Column(name = "sequence_no", nullable = false)
	private int sequenceNo;

	@Column(nullable = false, length = 255)
	private String description;

	@Column(nullable = false, precision = 12, scale = 2)
	private BigDecimal amount;

	@Column(name = "created_at", nullable = false)
	private LocalDateTime createdAt;

	@Column(name = "updated_at")
	private LocalDateTime updatedAt;

	protected QuotationLineItem() {
	}

	QuotationLineItem(Quotation quotation, QuotationLineItemRequest request) {
		this.id = UUID.randomUUID();
		this.quotation = quotation;
		update(request);
		this.createdAt = LocalDateTime.now();
	}

	void update(QuotationLineItemRequest request) {
		sequenceNo = request.sequenceNo();
		description = request.description().trim();
		amount = request.amount();
	}

	@PrePersist
	void prePersist() {
		if (id == null) id = UUID.randomUUID();
		if (createdAt == null) createdAt = LocalDateTime.now();
	}

	@PreUpdate
	void preUpdate() {
		updatedAt = LocalDateTime.now();
	}

	public UUID getId() { return id; }
	public int getSequenceNo() { return sequenceNo; }
	public String getDescription() { return description; }
	public BigDecimal getAmount() { return amount; }
	public LocalDateTime getCreatedAt() { return createdAt; }
	public LocalDateTime getUpdatedAt() { return updatedAt; }
}
