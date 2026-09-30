package com.horsetransport.document;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Lock;

class HorseDocumentRepositoryContractTest {

	@Test
	void ownershipMutationQueryUsesPessimisticWriteLock() throws Exception {
		Method method = HorseDocumentRepository.class.getMethod("findOwnedByIdForUpdate", UUID.class, UUID.class);

		assertThat(method.getAnnotation(Lock.class)).isNotNull();
		assertThat(method.getAnnotation(Lock.class).value()).isEqualTo(LockModeType.PESSIMISTIC_WRITE);
	}
}
