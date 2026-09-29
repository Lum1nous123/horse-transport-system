package com.horsetransport.document;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HorseDocumentRepository extends JpaRepository<HorseDocument, UUID> {

	@Query("select document from HorseDocument document "
			+ "where document.transportOrderHorse.id in :orderHorseIds")
	List<HorseDocument> findAllByOrderHorseIds(@Param("orderHorseIds") Collection<UUID> orderHorseIds);
}
