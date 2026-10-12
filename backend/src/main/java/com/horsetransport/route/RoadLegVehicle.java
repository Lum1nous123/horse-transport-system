package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "road_leg_vehicles")
public class RoadLegVehicle {

	@Id
	private UUID id;

	@Column(name = "route_leg_id", nullable = false)
	private UUID routeLegId;

	@Column(name = "vehicle_id", nullable = false)
	private UUID vehicleId;

	@Column(name = "assigned_at", nullable = false)
	private LocalDateTime assignedAt;

	protected RoadLegVehicle() {
	}

	public RoadLegVehicle(UUID routeLegId, UUID vehicleId) {
		this.id = UUID.randomUUID();
		this.routeLegId = routeLegId;
		this.vehicleId = vehicleId;
		this.assignedAt = LocalDateTime.now();
	}

	@PrePersist
	void prePersist() {
		if (id == null) {
			id = UUID.randomUUID();
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

	public UUID getVehicleId() {
		return vehicleId;
	}

	public LocalDateTime getAssignedAt() {
		return assignedAt;
	}
}