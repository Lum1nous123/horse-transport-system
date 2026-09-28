package com.horsetransport.payment;

import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PaymentAttemptRepository extends JpaRepository<PaymentAttempt, UUID> {

	Optional<PaymentAttempt> findFirstByPaymentIdOrderByAttemptNoDesc(UUID paymentId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select a from PaymentAttempt a where a.id = :id")
	Optional<PaymentAttempt> findByIdForUpdate(@Param("id") UUID id);
}
