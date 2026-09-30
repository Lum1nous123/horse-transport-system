package com.horsetransport.document;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HorseDocumentVersionRepository extends JpaRepository<HorseDocumentVersion, UUID> {

	Optional<HorseDocumentVersion> findByHorseDocument_IdAndCurrentTrue(UUID horseDocumentId);

	List<HorseDocumentVersion> findAllByHorseDocument_IdOrderByVersionNoDesc(UUID horseDocumentId);

	@Query("select coalesce(max(version.versionNo), 0) from HorseDocumentVersion version "
			+ "where version.horseDocument.id = :documentId")
	int findMaximumVersionNo(@Param("documentId") UUID documentId);

	@Query("select version from HorseDocumentVersion version "
			+ "where version.horseDocument.transportOrderHorse.id = :orderHorseId and version.current = true")
	List<HorseDocumentVersion> findCurrentByOrderHorseId(@Param("orderHorseId") UUID orderHorseId);
}
