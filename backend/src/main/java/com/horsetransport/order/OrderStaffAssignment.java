package com.horsetransport.order;

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
@Table(name = "order_staff_assignments")
public class OrderStaffAssignment {
	@Id
	private UUID id;

	@Column(name = "transport_order_id", nullable = false)
	private UUID transportOrderId;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(name = "assignment_role", nullable = false, columnDefinition = "order_staff_role")
	private OrderStaffRole assignmentRole;

	@Column(name = "user_id", nullable = false)
	private UUID userId;

	@Column(name = "assigned_by", nullable = false)
	private UUID assignedBy;

	@Column(name = "assigned_at", nullable = false)
	private LocalDateTime assignedAt;

	protected OrderStaffAssignment() {
	}

	private OrderStaffAssignment(UUID transportOrderId, OrderStaffRole assignmentRole, UUID userId, UUID assignedBy) {
		this.id = UUID.randomUUID();
		this.transportOrderId = transportOrderId;
		this.assignmentRole = assignmentRole;
		this.userId = userId;
		this.assignedBy = assignedBy;
		this.assignedAt = LocalDateTime.now();
	}

	public static OrderStaffAssignment assign(UUID orderId, OrderStaffRole role, UUID userId, UUID assignedBy) {
		return new OrderStaffAssignment(orderId, role, userId, assignedBy);
	}

	@PrePersist
	void prePersist() {
		if (id == null) id = UUID.randomUUID();
		if (assignedAt == null) assignedAt = LocalDateTime.now();
	}

	public UUID getId() { return id; }
	public UUID getTransportOrderId() { return transportOrderId; }
	public OrderStaffRole getAssignmentRole() { return assignmentRole; }
	public UUID getUserId() { return userId; }
	public UUID getAssignedBy() { return assignedBy; }
	public LocalDateTime getAssignedAt() { return assignedAt; }
}
