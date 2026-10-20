package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "vehicle_checkpoint_arrivals")
public class VehicleCheckpointArrival {

	@Id
	private UUID id;
	@Column(name = "road_vehicle_execution_id", nullable = false)
	private UUID roadVehicleExecutionId;
	@Column(name = "checkpoint_id", nullable = false)
	private UUID checkpointId;
	@Column(name = "recorded_by_driver_id", nullable = false)
	private UUID recordedByDriverId;
	@Column(name = "arrived_at", nullable = false)
	private LocalDateTime arrivedAt;

	protected VehicleCheckpointArrival() { }

	public VehicleCheckpointArrival(UUID executionId, UUID checkpointId, UUID driverId, LocalDateTime arrivedAt) {
		this.id = UUID.randomUUID();
		this.roadVehicleExecutionId = executionId;
		this.checkpointId = checkpointId;
		this.recordedByDriverId = driverId;
		this.arrivedAt = arrivedAt;
	}

	@PrePersist
	void prePersist() {
		if (id == null) id = UUID.randomUUID();
		if (arrivedAt == null) arrivedAt = LocalDateTime.now();
	}

	public UUID getId() { return id; }
	public UUID getRoadVehicleExecutionId() { return roadVehicleExecutionId; }
	public UUID getCheckpointId() { return checkpointId; }
	public UUID getRecordedByDriverId() { return recordedByDriverId; }
	public LocalDateTime getArrivedAt() { return arrivedAt; }
}
