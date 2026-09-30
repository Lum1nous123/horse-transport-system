package com.horsetransport.document;

import java.time.LocalDateTime;
import java.util.UUID;

import com.horsetransport.order.TransportOrderHorse;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "horse_documents")
public class HorseDocument {

	@Id
	private UUID id;

	@ManyToOne(optional = false)
	@JoinColumn(name = "transport_order_horse_id", nullable = false)
	private TransportOrderHorse transportOrderHorse;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(name = "document_type", nullable = false, columnDefinition = "document_type")
	private DocumentType documentType;

	@Column(name = "created_at", nullable = false)
	private LocalDateTime createdAt;

	@Column(name = "updated_at")
	private LocalDateTime updatedAt;

	protected HorseDocument() {
	}

	HorseDocument(TransportOrderHorse transportOrderHorse, DocumentType documentType) {
		this.id = UUID.randomUUID();
		this.transportOrderHorse = transportOrderHorse;
		this.documentType = documentType;
		this.createdAt = LocalDateTime.now();
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
	public UUID getTransportOrderHorseId() { return transportOrderHorse.getId(); }
	public TransportOrderHorse getTransportOrderHorse() { return transportOrderHorse; }
	public DocumentType getDocumentType() { return documentType; }
}
