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
@Table(name = "route_plans")
public class RoutePlan {

	@Id
	private UUID id;

	@Column(name = "transport_order_id", nullable = false, unique = true)
	private UUID transportOrderId;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(nullable = false, columnDefinition = "route_plan_status")
	private RoutePlanStatus status;

	@Column(name = "created_by", nullable = false)
	private UUID createdBy;

	@Column(name = "created_at", nullable = false)
	private LocalDateTime createdAt;

	@Column(name = "updated_at")
	private LocalDateTime updatedAt;

	@Column(name = "locked_at")
	private LocalDateTime lockedAt;

	@Column(name = "approved_at")
	private LocalDateTime approvedAt;

	protected RoutePlan() {
	}

	public RoutePlan(UUID transportOrderId, UUID createdBy) {
		this.id = UUID.randomUUID();
		this.transportOrderId = transportOrderId;
		this.createdBy = createdBy;
		this.status = RoutePlanStatus.DRAFT;
		this.createdAt = LocalDateTime.now();
	}

	@PrePersist
	void prePersist() {
		if (id == null) {
			id = UUID.randomUUID();
		}
		if (status == null) {
			status = RoutePlanStatus.DRAFT;
		}
		if (createdAt == null) {
			createdAt = LocalDateTime.now();
		}
	}

	@PreUpdate
	void preUpdate() {
		updatedAt = LocalDateTime.now();
	}

	public boolean isEditableByFrc() {
		return status == RoutePlanStatus.DRAFT || status == RoutePlanStatus.RETURNED;
	}

	public void submitForReview() {
		if (!isEditableByFrc()) {
			throw new RoutePlanNotEditableException();
		}
		status = RoutePlanStatus.PENDING_LM_REVIEW;
	}

	public void returnToFrc() {
		if (status != RoutePlanStatus.PENDING_LM_REVIEW) {
			throw new RoutePlanValidationException("Route plan is not pending Logistics Manager review");
		}
		status = RoutePlanStatus.RETURNED;
	}

	public void approve() {
		if (status != RoutePlanStatus.PENDING_LM_REVIEW) {
			throw new RoutePlanValidationException("Route plan is not pending Logistics Manager review");
		}
		status = RoutePlanStatus.APPROVED;
		LocalDateTime now = LocalDateTime.now();
		lockedAt = now;
		approvedAt = now;
	}

	public UUID getId() {
		return id;
	}

	public UUID getTransportOrderId() {
		return transportOrderId;
	}

	public RoutePlanStatus getStatus() {
		return status;
	}

	public UUID getCreatedBy() {
		return createdBy;
	}

	public LocalDateTime getCreatedAt() {
		return createdAt;
	}

	public LocalDateTime getUpdatedAt() {
		return updatedAt;
	}

	public LocalDateTime getLockedAt() {
		return lockedAt;
	}

	public LocalDateTime getApprovedAt() {
		return approvedAt;
	}
}
