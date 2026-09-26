package com.horsetransport.audit;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface StatusAuditLogRepository extends JpaRepository<StatusAuditLog, UUID> {
}
