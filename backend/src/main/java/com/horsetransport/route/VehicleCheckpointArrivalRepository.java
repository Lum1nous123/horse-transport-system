package com.horsetransport.route;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface VehicleCheckpointArrivalRepository extends JpaRepository<VehicleCheckpointArrival, UUID> {
	List<VehicleCheckpointArrival> findAllByRoadVehicleExecutionId(UUID roadVehicleExecutionId);
	List<VehicleCheckpointArrival> findAllByRoadVehicleExecutionIdIn(
			Collection<UUID> roadVehicleExecutionIds);
	Optional<VehicleCheckpointArrival> findByRoadVehicleExecutionIdAndCheckpointId(
			UUID roadVehicleExecutionId, UUID checkpointId);
}
