package com.horsetransport.route;

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
@Table(name = "checkpoints")
public class Checkpoint {

	@Id
	private UUID id;

	@Column(name = "route_leg_id", nullable = false)
	private UUID routeLegId;

	@Column(name = "sequence_no", nullable = false)
	private Integer sequenceNo;

	@Column(nullable = false, length = 150)
	private String name;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(name = "checkpoint_type", nullable = false, columnDefinition = "checkpoint_type")
	private CheckpointType checkpointType;

	@Column(name = "country_code", length = 10)
	private String countryCode;

	@Column(name = "minimum_required_stop_minutes")
	private Integer minimumRequiredStopMinutes;

	@Column(name = "planned_stop_duration_minutes")
	private Integer plannedStopDurationMinutes;

	@Column(columnDefinition = "text")
	private String notes;

	@Column(name = "created_at", nullable = false)
	private LocalDateTime createdAt;

	@Column(name = "updated_at")
	private LocalDateTime updatedAt;

	protected Checkpoint() {
	}

	public Checkpoint(UUID routeLegId, Integer sequenceNo, String name, CheckpointType checkpointType,
			String countryCode, Integer minimumRequiredStopMinutes, Integer plannedStopDurationMinutes,
			String notes) {
		this.id = UUID.randomUUID();
		this.routeLegId = routeLegId;
		this.sequenceNo = sequenceNo;
		this.name = name;
		this.checkpointType = checkpointType;
		this.countryCode = countryCode;
		this.minimumRequiredStopMinutes = minimumRequiredStopMinutes;
		this.plannedStopDurationMinutes = plannedStopDurationMinutes;
		this.notes = notes;
		this.createdAt = LocalDateTime.now();
	}

	@PrePersist
	void prePersist() {
		if (id == null) {
			id = UUID.randomUUID();
		}
		if (createdAt == null) {
			createdAt = LocalDateTime.now();
		}
	}

	@PreUpdate
	void preUpdate() {
		updatedAt = LocalDateTime.now();
	}

	public UUID getId() {
		return id;
	}

	public UUID getRouteLegId() {
		return routeLegId;
	}

	public Integer getSequenceNo() {
		return sequenceNo;
	}

	public String getName() {
		return name;
	}

	public CheckpointType getCheckpointType() {
		return checkpointType;
	}

	public String getCountryCode() {
		return countryCode;
	}

	public Integer getMinimumRequiredStopMinutes() {
		return minimumRequiredStopMinutes;
	}

	public Integer getPlannedStopDurationMinutes() {
		return plannedStopDurationMinutes;
	}

	public String getNotes() {
		return notes;
	}

	public LocalDateTime getCreatedAt() {
		return createdAt;
	}

	public LocalDateTime getUpdatedAt() {
		return updatedAt;
	}
}
