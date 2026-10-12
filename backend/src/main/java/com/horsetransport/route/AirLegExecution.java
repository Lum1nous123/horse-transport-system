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
@Table(name = "air_leg_executions")
public class AirLegExecution {

	@Id
	private UUID id;

	@Column(name = "route_leg_id", nullable = false, unique = true)
	private UUID routeLegId;

	@Column(name = "escort_id", nullable = false)
	private UUID escortId;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(nullable = false, columnDefinition = "execution_status")
	private ExecutionStatus status;

	@Column(name = "assigned_at", nullable = false)
	private LocalDateTime assignedAt;

	@Column(name = "started_at")
	private LocalDateTime startedAt;

	@Column(name = "destination_arrived_at")
	private LocalDateTime destinationArrivedAt;

	@Column(name = "completed_at")
	private LocalDateTime completedAt;

	protected AirLegExecution() {
	}

	public AirLegExecution(UUID routeLegId, UUID escortId) {
		this.id = UUID.randomUUID();
		this.routeLegId = routeLegId;
		this.escortId = escortId;
		this.status = ExecutionStatus.NOT_STARTED;
		this.assignedAt = LocalDateTime.now();
	}

	@PrePersist
	void prePersist() {
		if (id == null) {
			id = UUID.randomUUID();
		}
		if (status == null) {
			status = ExecutionStatus.NOT_STARTED;
		}
		if (assignedAt == null) {
			assignedAt = LocalDateTime.now();
		}
	}

	public UUID getId() {
		return id;
	}

	public UUID getRouteLegId() {
		return routeLegId;
	}

	public UUID getEscortId() {
		return escortId;
	}

	public ExecutionStatus getStatus() {
		return status;
	}

	public LocalDateTime getAssignedAt() {
		return assignedAt;
	}

	public LocalDateTime getStartedAt() {
		return startedAt;
	}

	public LocalDateTime getDestinationArrivedAt() {
		return destinationArrivedAt;
	}

	public LocalDateTime getCompletedAt() {
		return completedAt;
	}
}
