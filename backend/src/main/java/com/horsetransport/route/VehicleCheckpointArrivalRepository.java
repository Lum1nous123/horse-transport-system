package com.horsetransport.route;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface VehicleCheckpointArrivalRepository extends JpaRepository<VehicleCheckpointArrival, UUID> {
	List<VehicleCheckpointArrival> findAllByRoadVehicleExecutionId(UUID roadVehicleExecutionId);
	Optional<VehicleCheckpointArrival> findByRoadVehicleExecutionIdAndCheckpointId(
			UUID roadVehicleExecutionId, UUID checkpointId);
}
