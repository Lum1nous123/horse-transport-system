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
@Table(name = "vehicles")
public class Vehicle {

	@Id
	private UUID id;

	@Column(name = "plate_number", nullable = false, unique = true, length = 50)
	private String plateNumber;

	@Column(name = "vehicle_name", length = 120)
	private String vehicleName;

	@Column(name = "vehicle_type", length = 100)
	private String vehicleType;

	@Column(name = "horse_capacity", nullable = false)
	private Integer horseCapacity;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(nullable = false, columnDefinition = "vehicle_status")
	private VehicleStatus status;

	@Column(columnDefinition = "text")
	private String notes;

	@Column(name = "created_at", nullable = false)
	private LocalDateTime createdAt;

	@Column(name = "updated_at")
	private LocalDateTime updatedAt;

	protected Vehicle() {
	}

	public Vehicle(String plateNumber, String vehicleName, String vehicleType,
			Integer horseCapacity, VehicleStatus status, String notes) {
		this.id = UUID.randomUUID();
		this.plateNumber = plateNumber;
		this.vehicleName = vehicleName;
		this.vehicleType = vehicleType;
		this.horseCapacity = horseCapacity;
		this.status = status;
		this.notes = notes;
		this.createdAt = LocalDateTime.now();
	}

	@PrePersist
	void prePersist() {
		if (id == null) {
			id = UUID.randomUUID();
		}
		if (status == null) {
			status = VehicleStatus.AVAILABLE;
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

	public String getPlateNumber() {
		return plateNumber;
	}

	public String getVehicleName() {
		return vehicleName;
	}

	public String getVehicleType() {
		return vehicleType;
	}

	public Integer getHorseCapacity() {
		return horseCapacity;
	}

	public VehicleStatus getStatus() {
		return status;
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