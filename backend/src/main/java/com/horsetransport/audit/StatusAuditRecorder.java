package com.horsetransport.audit;

import java.util.Objects;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Shared transactional contract for covered status transitions.
 *
 * Call from the business operation's transaction. MANDATORY prevents a caller
 * from accidentally committing an audit row independently of its state change;
 * saveAndFlush surfaces persistence failures before the business method returns.
 */
@Service
public class StatusAuditRecorder {

	private final StatusAuditLogRepository repository;

	public StatusAuditRecorder(StatusAuditLogRepository repository) {
		this.repository = repository;
	}

	@Transactional(propagation = Propagation.MANDATORY)
	public void recordUserTransition(AuditEntityType entityType, UUID entityId, String oldStatus,
			String newStatus, UUID actorUserId, String reason) {
		record(StatusAuditLog.userTransition(Objects.requireNonNull(entityType), entityId,
				oldStatus, newStatus, actorUserId, reason));
	}

	@Transactional(propagation = Propagation.MANDATORY)
	public void recordSystemTransition(AuditEntityType entityType, UUID entityId, String oldStatus,
			String newStatus) {
		record(StatusAuditLog.systemTransition(Objects.requireNonNull(entityType), entityId,
				oldStatus, newStatus));
	}

	@Transactional(propagation = Propagation.MANDATORY)
	public void recordSystemTransition(AuditEntityType entityType, UUID entityId, String oldStatus,
			String newStatus, String reason) {
		record(StatusAuditLog.systemTransition(Objects.requireNonNull(entityType), entityId,
				oldStatus, newStatus, reason));
	}

	private void record(StatusAuditLog audit) {
		Objects.requireNonNull(audit.getEntityId(), "Audit entity ID is required");
		if (Objects.equals(audit.getOldStatus(), audit.getNewStatus())) {
			throw new IllegalArgumentException("A status audit must represent a status change");
		}
		repository.saveAndFlush(audit);
	}
}
