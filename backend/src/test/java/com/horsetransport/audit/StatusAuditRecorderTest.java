package com.horsetransport.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

class StatusAuditRecorderTest {

	private final StatusAuditLogRepository repository = mock(StatusAuditLogRepository.class);
	private final StatusAuditRecorder recorder = new StatusAuditRecorder(repository);

	@Test
	void recordSystemTransitionFlushesWhitelistedEntityAudit() {
		UUID entityId = UUID.randomUUID();

		recorder.recordSystemTransition(AuditEntityType.ROUTE_LEG, entityId, "READY", "IN_PROGRESS");

		org.mockito.ArgumentCaptor<StatusAuditLog> audit = org.mockito.ArgumentCaptor.forClass(StatusAuditLog.class);
		verify(repository).saveAndFlush(audit.capture());
		assertThat(audit.getValue().getEntityType()).isEqualTo(AuditEntityType.ROUTE_LEG);
		assertThat(audit.getValue().getEntityId()).isEqualTo(entityId);
		assertThat(audit.getValue().getOldStatus()).isEqualTo("READY");
		assertThat(audit.getValue().getNewStatus()).isEqualTo("IN_PROGRESS");
		assertThat(audit.getValue().getActorKind()).isEqualTo(AuditActorKind.SYSTEM);
		assertThat(audit.getValue().getActorUserId()).isNull();
		assertThat(audit.getValue().getOccurredAt()).isNotNull();
	}

	@Test
	void rejectsNoOpTransitionWithoutWritingAudit() {
		assertThatThrownBy(() -> recorder.recordSystemTransition(
				AuditEntityType.TRANSPORT_ORDER, UUID.randomUUID(), "IN_PROGRESS", "IN_PROGRESS"))
				.isInstanceOf(IllegalArgumentException.class);
		org.mockito.Mockito.verifyNoInteractions(repository);
	}

	@Test
	void propagatesAuditWriteFailureToFailTheEnclosingTransaction() {
		RuntimeException failure = new RuntimeException("audit unavailable");
		when(repository.saveAndFlush(org.mockito.ArgumentMatchers.any())).thenThrow(failure);

		assertThatThrownBy(() -> recorder.recordSystemTransition(
				AuditEntityType.TRANSPORT_ORDER, UUID.randomUUID(), "APPROVED", "READY_TO_SHIP"))
				.isSameAs(failure);
	}

	@Test
	void recorderRequiresTheFeatureTransactionInsteadOfStartingAnIndependentOne() throws Exception {
		Transactional transaction = StatusAuditRecorder.class
				.getMethod("recordSystemTransition", AuditEntityType.class, UUID.class, String.class, String.class)
				.getAnnotation(Transactional.class);
		assertThat(transaction).isNotNull();
		assertThat(transaction.propagation()).isEqualTo(Propagation.MANDATORY);
	}
}
