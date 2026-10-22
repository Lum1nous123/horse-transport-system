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
import org.hibernate.annotations.ColumnTransformer;
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
	@JdbcTypeCode(SqlTypes.VARCHAR)
	@ColumnTransformer(read = "status::text", write = "?::execution_status")
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

	public void start(LocalDateTime startedAt) {
		// chỉ cho phép bắt đầu khi chuyến AIR chưa được bắt đầu
		if (status != ExecutionStatus.NOT_STARTED) {
			throw new RoutePlanValidationException("AIR leg execution has already started");
		}
		// đánh dấu chuyến AIR đã bắt đầu thực hiện
		status = ExecutionStatus.IN_PROGRESS;
		this.startedAt = startedAt;
	}

	// đánh dấu chuyến AIR đã đến nơi
	public void arriveAtDestination(LocalDateTime arrivedAt) {
		// chỉ cho phép đánh dấu đến nơi khi chuyến AIR đang trong tiến trình thực hiện
		if (status != ExecutionStatus.IN_PROGRESS) {
			throw new RoutePlanValidationException("AIR leg must be in progress before destination arrival");
		}

		// đánh dấu chuyến AIR đã đến nơi
		status = ExecutionStatus.DESTINATION;
		this.destinationArrivedAt = arrivedAt;
	}

	// hoàn tất chuyến bay và nhận vào thời gian hoàn tất
	public void complete(LocalDateTime completedAt) {
		// kiểm tra AIR đến đích chưa
		if (status != ExecutionStatus.DESTINATION) {
			throw new RoutePlanValidationException("AIR leg requires destination arrival and final welfare to complete");
		}
		// đánh dấu chuyến AIR đã hoàn tất
		status = ExecutionStatus.COMPLETED;
		// nhận vào thời gian hoàn tất
		this.completedAt = completedAt;
	}
}
