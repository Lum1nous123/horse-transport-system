package com.horsetransport.route;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

public interface CheckpointRepository extends JpaRepository<Checkpoint, UUID> {

	List<Checkpoint> findAllByRouteLegIdOrderBySequenceNoAsc(UUID routeLegId);

	List<Checkpoint> findAllByRouteLegIdIn(Collection<UUID> routeLegIds);

	@Modifying
	void deleteAllByRouteLegId(UUID routeLegId);
}
