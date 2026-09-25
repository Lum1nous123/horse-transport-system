package com.horsetransport.horse;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "horses")
public class Horse {

	@Id
	private UUID id;

	@Column(name = "customer_id", nullable = false)
	private UUID customerId;

	@Column(nullable = false, length = 120)
	private String name;

	@Column(name = "passport_number", length = 100)
	private String passportNumber;

	@Column(name = "microchip_id", nullable = false, unique = true, length = 50)
	private String microchipId;

	@Column(length = 100)
	private String breed;

	@Column(length = 20)
	private String sex;

	@Column(name = "date_of_birth")
	private LocalDate dateOfBirth;

	@Column(columnDefinition = "text")
	private String notes;

	@Column(name = "created_at", nullable = false)
	private LocalDateTime createdAt;

	@Column(name = "updated_at")
	private LocalDateTime updatedAt;

	protected Horse() {
	}

	Horse(UUID customerId, String name, String passportNumber, String microchipId,
			String breed, String sex, LocalDate dateOfBirth, String notes) {
		this.id = UUID.randomUUID();
		this.customerId = customerId;
		this.name = name;
		this.passportNumber = passportNumber;
		this.microchipId = microchipId;
		this.breed = breed;
		this.sex = sex;
		this.dateOfBirth = dateOfBirth;
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

	public UUID getCustomerId() {
		return customerId;
	}

	public String getName() {
		return name;
	}

	public String getPassportNumber() {
		return passportNumber;
	}

	public String getMicrochipId() {
		return microchipId;
	}

	public String getBreed() {
		return breed;
	}

	public String getSex() {
		return sex;
	}

	public LocalDate getDateOfBirth() {
		return dateOfBirth;
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
