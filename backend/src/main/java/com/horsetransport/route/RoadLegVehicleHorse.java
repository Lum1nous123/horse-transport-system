package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "road_leg_vehicle_horses")
public class RoadLegVehicleHorse {

	@Id
	private UUID id;

	@Column(name = "route_leg_id", nullable = false)
	private UUID routeLegId;

	@Column(name = "road_leg_vehicle_id", nullable = false)
	private UUID roadLegVehicleId;

	@Column(name = "transport_order_horse_id", nullable = false)
	private UUID transportOrderHorseId;

	@Column(name = "assigned_at", nullable = false)
	private LocalDateTime assignedAt;

	protected RoadLegVehicleHorse() {
	}

	public RoadLegVehicleHorse(UUID routeLegId, UUID roadLegVehicleId, UUID transportOrderHorseId) {
		this.id = UUID.randomUUID();
		this.routeLegId = routeLegId;
		this.roadLegVehicleId = roadLegVehicleId;
		this.transportOrderHorseId = transportOrderHorseId;
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

	public UUID getRoadLegVehicleId() {
		return roadLegVehicleId;
	}

	public UUID getTransportOrderHorseId() {
		return transportOrderHorseId;
	}

	public LocalDateTime getAssignedAt() {
		return assignedAt;
	}
}
