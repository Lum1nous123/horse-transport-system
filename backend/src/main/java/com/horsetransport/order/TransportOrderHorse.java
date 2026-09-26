package com.horsetransport.order;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "transport_order_horses")
public class TransportOrderHorse {

	@Id
	private UUID id;

	@ManyToOne(optional = false)
	@JoinColumn(name = "transport_order_id", nullable = false)
	private TransportOrder transportOrder;

	@Column(name = "horse_id", nullable = false)
	private UUID horseId;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(name = "document_status", nullable = false, columnDefinition = "order_horse_document_status")
	private OrderHorseDocumentStatus documentStatus;

	@Column(name = "travel_notes", columnDefinition = "text")
	private String travelNotes;

	@Column(name = "created_at", nullable = false)
	private LocalDateTime createdAt;

	@Column(name = "updated_at")
	private LocalDateTime updatedAt;

	protected TransportOrderHorse() {
	}

	TransportOrderHorse(TransportOrder transportOrder, UUID horseId) {
		this.id = UUID.randomUUID();
		this.transportOrder = transportOrder;
		this.horseId = horseId;
		this.documentStatus = OrderHorseDocumentStatus.INCOMPLETE;
		this.createdAt = LocalDateTime.now();
	}

	@PrePersist
	void prePersist() {
		if (id == null) {
			id = UUID.randomUUID();
		}
		if (documentStatus == null) {
			documentStatus = OrderHorseDocumentStatus.INCOMPLETE;
		}
		if (createdAt == null) {
			createdAt = LocalDateTime.now();
		}
	}

	public UUID getHorseId() {
		return horseId;
	}
}
