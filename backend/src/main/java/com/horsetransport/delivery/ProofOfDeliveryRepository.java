package com.horsetransport.delivery;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProofOfDeliveryRepository extends JpaRepository<ProofOfDelivery, UUID> {

	Optional<ProofOfDelivery> findByRoadVehicleExecutionId(UUID roadVehicleExecutionId);

	Optional<ProofOfDelivery> findByAirLegExecutionId(UUID airLegExecutionId);

	List<ProofOfDelivery> findAllByRoadVehicleExecutionIdIn(Collection<UUID> roadVehicleExecutionIds);
}
