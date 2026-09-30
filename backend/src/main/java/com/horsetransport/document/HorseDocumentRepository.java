package com.horsetransport.document;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HorseDocumentRepository extends JpaRepository<HorseDocument, UUID> {

	@Query("select document from HorseDocument document "
			+ "where document.transportOrderHorse.id in :orderHorseIds")
	List<HorseDocument> findAllByOrderHorseIds(@Param("orderHorseIds") Collection<UUID> orderHorseIds);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select document from HorseDocument document "
			+ "join fetch document.transportOrderHorse orderHorse "
			+ "join fetch orderHorse.transportOrder transportOrder "
			+ "where document.id = :documentId and transportOrder.customerId = :customerId")
	java.util.Optional<HorseDocument> findOwnedByIdForUpdate(@Param("documentId") UUID documentId,
			@Param("customerId") UUID customerId);

	@Query("select document from HorseDocument document "
			+ "join fetch document.transportOrderHorse orderHorse "
			+ "join fetch orderHorse.transportOrder transportOrder "
			+ "where document.id = :documentId and transportOrder.customerId = :customerId")
	java.util.Optional<HorseDocument> findOwnedById(@Param("documentId") UUID documentId,
			@Param("customerId") UUID customerId);
}
