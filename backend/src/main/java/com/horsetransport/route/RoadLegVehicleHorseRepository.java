package com.horsetransport.route;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

public interface RoadLegVehicleHorseRepository extends JpaRepository<RoadLegVehicleHorse, UUID> {

	List<RoadLegVehicleHorse> findAllByRouteLegId(UUID routeLegId);

	List<RoadLegVehicleHorse> findAllByRouteLegIdIn(Collection<UUID> routeLegIds);

	@Modifying
	void deleteAllByRouteLegId(UUID routeLegId);
}