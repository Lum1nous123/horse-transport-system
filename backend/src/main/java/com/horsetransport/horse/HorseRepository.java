package com.horsetransport.horse;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HorseRepository extends JpaRepository<Horse, UUID> {

	boolean existsByMicrochipId(String microchipId);

	List<Horse> findAllByCustomerId(UUID customerId);

	List<Horse> findAllByIdInAndCustomerId(Collection<UUID> ids, UUID customerId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select horse from Horse horse where horse.id = :id and horse.customerId = :customerId")
	Optional<Horse> findOwnedByIdForUpdate(@Param("id") UUID id, @Param("customerId") UUID customerId);

	@Query(value = "select exists (select 1 from transport_order_horses where horse_id = :horseId)",
			nativeQuery = true)
	boolean existsTransportOrderReference(@Param("horseId") UUID horseId);

}
