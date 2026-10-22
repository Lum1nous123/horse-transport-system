package com.horsetransport.delivery;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "proofs_of_delivery")
public class ProofOfDelivery {

	@Id
	private UUID id;

	@Column(name = "road_vehicle_execution_id")
	private UUID roadVehicleExecutionId;

	@Column(name = "air_leg_execution_id")
	private UUID airLegExecutionId;

	@Column(name = "recipient_name", nullable = false, length = 150)
	private String recipientName;

	@Column(name = "proof_photo_url", nullable = false, length = 500)
	private String proofPhotoUrl;

	@Column(name = "handover_note", columnDefinition = "text")
	private String handoverNote;

	@Column(name = "confirmed_by_escort_id", nullable = false)
	private UUID confirmedByEscortId;

	@Column(name = "delivered_at", nullable = false)
	private LocalDateTime deliveredAt;

	@Column(name = "created_at", nullable = false)
	private LocalDateTime createdAt;

	protected ProofOfDelivery() {
	}

	public static ProofOfDelivery forRoad(UUID roadVehicleExecutionId, String recipientName,
			String proofPhotoUrl, String handoverNote, UUID escortId, LocalDateTime deliveredAt) {
		return new ProofOfDelivery(roadVehicleExecutionId, null, recipientName, proofPhotoUrl,
				handoverNote, escortId, deliveredAt);
	}

	public static ProofOfDelivery forAir(UUID airLegExecutionId, String recipientName,
			String proofPhotoUrl, String handoverNote, UUID escortId, LocalDateTime deliveredAt) {
		return new ProofOfDelivery(null, airLegExecutionId, recipientName, proofPhotoUrl,
				handoverNote, escortId, deliveredAt);
	}

	private ProofOfDelivery(UUID roadVehicleExecutionId, UUID airLegExecutionId,
			String recipientName, String proofPhotoUrl, String handoverNote,
			UUID confirmedByEscortId, LocalDateTime deliveredAt) {
		this.id = UUID.randomUUID();
		this.roadVehicleExecutionId = roadVehicleExecutionId;
		this.airLegExecutionId = airLegExecutionId;
		this.recipientName = recipientName;
		this.proofPhotoUrl = proofPhotoUrl;
		this.handoverNote = handoverNote;
		this.confirmedByEscortId = confirmedByEscortId;
		this.deliveredAt = deliveredAt;
		this.createdAt = deliveredAt;
	}

	@PrePersist
	void prePersist() {
		if (id == null) id = UUID.randomUUID();
		if (createdAt == null) createdAt = LocalDateTime.now();
	}

	public UUID getId() { return id; }
	public UUID getRoadVehicleExecutionId() { return roadVehicleExecutionId; }
	public UUID getAirLegExecutionId() { return airLegExecutionId; }
	public String getRecipientName() { return recipientName; }
	public String getProofPhotoUrl() { return proofPhotoUrl; }
	public String getHandoverNote() { return handoverNote; }
	public UUID getConfirmedByEscortId() { return confirmedByEscortId; }
	public LocalDateTime getDeliveredAt() { return deliveredAt; }
	public LocalDateTime getCreatedAt() { return createdAt; }
}
