package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "welfare_evidence")
public class WelfareEvidence {

	@Id
	private UUID id;
	@Column(name = "road_vehicle_execution_id")
	private UUID roadVehicleExecutionId;
	@Column(name = "air_leg_execution_id")
	private UUID airLegExecutionId;
	@Column(name = "checkpoint_id")
	private UUID checkpointId;
	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(name = "event_type", nullable = false, columnDefinition = "welfare_event_type")
	private WelfareEventType eventType;
	@Column(name = "photo_url", nullable = false, length = 500)
	private String photoUrl;
	@Column(nullable = false, columnDefinition = "text")
	private String note;
	@Column(name = "recorded_by_escort_id", nullable = false)
	private UUID recordedByEscortId;
	@Column(name = "recorded_at", nullable = false)
	private LocalDateTime recordedAt;

	protected WelfareEvidence() { }

	public WelfareEvidence(UUID roadVehicleExecutionId, UUID checkpointId, WelfareEventType eventType,
			String photoUrl, String note, UUID escortId, LocalDateTime recordedAt) {
		this.id = UUID.randomUUID();
		this.roadVehicleExecutionId = roadVehicleExecutionId;
		this.checkpointId = checkpointId;
		this.eventType = eventType;
		this.photoUrl = photoUrl;
		this.note = note;
		this.recordedByEscortId = escortId;
		this.recordedAt = recordedAt;
	}

	public WelfareEvidence(UUID airLegExecutionId, WelfareEventType eventType, String photoUrl,
			String note, UUID escortId, LocalDateTime recordedAt) {
		this.airLegExecutionId = airLegExecutionId;
		this.eventType = eventType;
		this.photoUrl = photoUrl;
		this.note = note;
		this.recordedByEscortId = escortId;
		this.recordedAt = recordedAt;
	}

	@PrePersist
	void prePersist() {
		if (id == null) id = UUID.randomUUID();
		if (recordedAt == null) recordedAt = LocalDateTime.now();
	}

	public UUID getId() { return id; }
	public UUID getRoadVehicleExecutionId() { return roadVehicleExecutionId; }
	public UUID getAirLegExecutionId() { return airLegExecutionId; }
	public UUID getCheckpointId() { return checkpointId; }
	public WelfareEventType getEventType() { return eventType; }
	public String getPhotoUrl() { return photoUrl; }
	public String getNote() { return note; }
	public UUID getRecordedByEscortId() { return recordedByEscortId; }
	public LocalDateTime getRecordedAt() { return recordedAt; }
}
