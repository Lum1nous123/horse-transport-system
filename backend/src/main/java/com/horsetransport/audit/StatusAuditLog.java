package com.horsetransport.audit;

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
@Table(name = "status_audit_logs")
public class StatusAuditLog {
	@Id
	private UUID id;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(name = "entity_type", nullable = false, columnDefinition = "audit_entity_type")
	private AuditEntityType entityType;

	@Column(name = "entity_id", nullable = false)
	private UUID entityId;

	@Column(name = "old_status", nullable = false, length = 80)
	private String oldStatus;

	@Column(name = "new_status", nullable = false, length = 80)
	private String newStatus;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(name = "actor_kind", nullable = false, columnDefinition = "audit_actor_kind")
	private AuditActorKind actorKind;

	@Column(name = "actor_user_id")
	private UUID actorUserId;

	@Column(columnDefinition = "text")
	private String reason;

	@Column(name = "occurred_at", nullable = false)
	private LocalDateTime occurredAt;

	protected StatusAuditLog() {
	}

	public static StatusAuditLog userTransition(UUID entityId, String oldStatus, String newStatus, UUID actorUserId) {
		return userTransition(entityId, oldStatus, newStatus, actorUserId, null);
	}

	public static StatusAuditLog userTransition(UUID entityId, String oldStatus, String newStatus,
			UUID actorUserId, String reason) {
		StatusAuditLog log = new StatusAuditLog();
		log.id = UUID.randomUUID();
		log.entityType = AuditEntityType.TRANSPORT_ORDER;
		log.entityId = entityId;
		log.oldStatus = oldStatus;
		log.newStatus = newStatus;
		log.actorKind = AuditActorKind.USER;
		log.actorUserId = actorUserId;
		log.reason = reason;
		log.occurredAt = LocalDateTime.now();
		return log;
	}

	@PrePersist
	void prePersist() {
		if (id == null) id = UUID.randomUUID();
		if (occurredAt == null) occurredAt = LocalDateTime.now();
	}

	public AuditEntityType getEntityType() { return entityType; }
	public UUID getEntityId() { return entityId; }
	public String getOldStatus() { return oldStatus; }
	public String getNewStatus() { return newStatus; }
	public AuditActorKind getActorKind() { return actorKind; }
	public UUID getActorUserId() { return actorUserId; }
	public String getReason() { return reason; }
}
