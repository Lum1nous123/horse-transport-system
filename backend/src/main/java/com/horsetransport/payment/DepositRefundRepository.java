package com.horsetransport.payment;

import java.util.Optional;
import java.util.UUID;
import java.time.LocalDateTime;
import java.util.List;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DepositRefundRepository extends JpaRepository<DepositRefund, UUID> {

	Optional<DepositRefund> findByPaymentId(UUID paymentId);

	@Query("select r.id from DepositRefund r where r.completedAt is null and (r.nextAttemptAt is null or r.nextAttemptAt <= :now) order by r.requestedAt")
	List<UUID> findDueIds(@Param("now") LocalDateTime now, org.springframework.data.domain.Pageable pageable);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select r from DepositRefund r where r.id = :id")
	Optional<DepositRefund> findByIdForUpdate(@Param("id") UUID id);
}
