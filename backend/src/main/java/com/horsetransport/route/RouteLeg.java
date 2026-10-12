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
@Table(name = "route_legs")
public class RouteLeg {

	@Id
	private UUID id;

	@Column(name = "route_plan_id", nullable = false)
	private UUID routePlanId;

	@Column(name = "sequence_no", nullable = false)
	private Integer sequenceNo;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(name = "leg_type", nullable = false, columnDefinition = "route_leg_type")
	private RouteLegType legType;

	@Column(nullable = false)
	private String origin;

	@Column(nullable = false)
	private String destination;

	@Column(name = "planned_departure_at", nullable = false)
	private LocalDateTime plannedDepartureAt;

	@Column(name = "planned_arrival_at", nullable = false)
	private LocalDateTime plannedArrivalAt;

	@Column(name = "air_provider_name")
	private String airProviderName;

	@Column(name = "air_reference")
	private String airReference;

	@Column(name = "air_capacity_horses")
	private Integer airCapacityHorses;

	@Column(name = "equipment_details")
	private String equipmentDetails;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(nullable = false, columnDefinition = "route_leg_status")
	private RouteLegStatus status;

	@Column
	private String notes;

	@Column(name = "started_at")
	private LocalDateTime startedAt;

	@Column(name = "completed_at")
	private LocalDateTime completedAt;

	@Column(name = "created_at", nullable = false)
	private LocalDateTime createdAt;

	@Column(name = "updated_at")
	private LocalDateTime updatedAt;

	protected RouteLeg() {
	}

	public RouteLeg(UUID routePlanId, Integer sequenceNo, RouteLegType legType, String origin, String destination,
			LocalDateTime plannedDepartureAt, LocalDateTime plannedArrivalAt, String airProviderName,
			String airReference, Integer airCapacityHorses, String equipmentDetails, String notes) {
		this.id = UUID.randomUUID();
		this.routePlanId = routePlanId;
		this.sequenceNo = sequenceNo;
		this.legType = legType;
		this.origin = origin;
		this.destination = destination;
		this.plannedDepartureAt = plannedDepartureAt;
		this.plannedArrivalAt = plannedArrivalAt;
		this.airProviderName = airProviderName;
		this.airReference = airReference;
		this.airCapacityHorses = airCapacityHorses;
		this.equipmentDetails = equipmentDetails;
		this.notes = notes;
		this.status = RouteLegStatus.PLANNED;
		this.createdAt = LocalDateTime.now();
	}

	@PrePersist
	void prePersist() {
		if (id == null) {
			id = UUID.randomUUID();
		}
		if (status == null) {
			status = RouteLegStatus.PLANNED;
		}
		if (createdAt == null) {
			createdAt = LocalDateTime.now();
		}
	}

	@PreUpdate
	void preUpdate() {
		updatedAt = LocalDateTime.now();
	}

	public void update(Integer sequenceNo, RouteLegType legType, String origin, String destination,
			LocalDateTime plannedDepartureAt, LocalDateTime plannedArrivalAt, String airProviderName,
			String airReference, Integer airCapacityHorses, String equipmentDetails, String notes) {
		this.sequenceNo = sequenceNo;
		this.legType = legType;
		this.origin = origin;
		this.destination = destination;
		this.plannedDepartureAt = plannedDepartureAt;
		this.plannedArrivalAt = plannedArrivalAt;
		this.airProviderName = airProviderName;
		this.airReference = airReference;
		this.airCapacityHorses = airCapacityHorses;
		this.equipmentDetails = equipmentDetails;
		this.notes = notes;
	}

    	public void changeSequence(Integer sequenceNo) {
		this.sequenceNo = sequenceNo;
	}

	public UUID getId() {
		return id;
	}

	public UUID getRoutePlanId() {
		return routePlanId;
	}

	public Integer getSequenceNo() {
		return sequenceNo;
	}

	public RouteLegType getLegType() {
		return legType;
	}

	public String getOrigin() {
		return origin;
	}

	public String getDestination() {
		return destination;
	}

	public LocalDateTime getPlannedDepartureAt() {
		return plannedDepartureAt;
	}

	public LocalDateTime getPlannedArrivalAt() {
		return plannedArrivalAt;
	}

	public String getAirProviderName() {
		return airProviderName;
	}

	public String getAirReference() {
		return airReference;
	}

	public Integer getAirCapacityHorses() {
		return airCapacityHorses;
	}

	public String getEquipmentDetails() {
		return equipmentDetails;
	}

	public RouteLegStatus getStatus() {
		return status;
	}

	public String getNotes() {
		return notes;
	}

	public LocalDateTime getStartedAt() {
		return startedAt;
	}

	public LocalDateTime getCompletedAt() {
		return completedAt;
	}

	public LocalDateTime getCreatedAt() {
		return createdAt;
	}

	public LocalDateTime getUpdatedAt() {
		return updatedAt;
	}
}
