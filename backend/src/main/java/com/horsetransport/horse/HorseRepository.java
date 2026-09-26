package com.horsetransport.horse;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface HorseRepository extends JpaRepository<Horse, UUID> {

	boolean existsByMicrochipId(String microchipId);

	List<Horse> findAllByCustomerId(UUID customerId);

	List<Horse> findAllByIdInAndCustomerId(Collection<UUID> ids, UUID customerId);

}
