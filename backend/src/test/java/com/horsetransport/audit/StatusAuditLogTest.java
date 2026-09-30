package com.horsetransport.audit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;

import org.junit.jupiter.api.Test;

class StatusAuditLogTest {

	private static final UUID ENTITY_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final UUID USER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

	@Test
	void userTransitionCapturesCompleteAuditPayload() {
		StatusAuditLog audit = StatusAuditLog.userTransition(AuditEntityType.QUOTATION, ENTITY_ID,
				"DRAFT", "SENT", USER_ID, "Confirmed quote");

		assertThat(audit.getEntityType()).isEqualTo(AuditEntityType.QUOTATION);
		assertThat(audit.getEntityId()).isEqualTo(ENTITY_ID);
		assertThat(audit.getOldStatus()).isEqualTo("DRAFT");
		assertThat(audit.getNewStatus()).isEqualTo("SENT");
		assertThat(audit.getActorKind()).isEqualTo(AuditActorKind.USER);
		assertThat(audit.getActorUserId()).isEqualTo(USER_ID);
		assertThat(audit.getReason()).isEqualTo("Confirmed quote");
		assertThat(audit.getOccurredAt()).isNotNull();
	}

	@Test
	void systemTransitionCapturesSystemActorWithoutUserOrReason() {
		StatusAuditLog audit = StatusAuditLog.systemTransition(AuditEntityType.TRANSPORT_ORDER,
				ENTITY_ID, "QUOTATION_SENT", "APPROVED");

		assertThat(audit.getEntityType()).isEqualTo(AuditEntityType.TRANSPORT_ORDER);
		assertThat(audit.getEntityId()).isEqualTo(ENTITY_ID);
		assertThat(audit.getOldStatus()).isEqualTo("QUOTATION_SENT");
		assertThat(audit.getNewStatus()).isEqualTo("APPROVED");
		assertThat(audit.getActorKind()).isEqualTo(AuditActorKind.SYSTEM);
		assertThat(audit.getActorUserId()).isNull();
		assertThat(audit.getReason()).isNull();
		assertThat(audit.getOccurredAt()).isNotNull();
	}
}
