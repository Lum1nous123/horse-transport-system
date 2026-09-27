package com.horsetransport.quotation;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QuotationRepository extends JpaRepository<Quotation, UUID> {

	boolean existsByTransportOrderId(UUID transportOrderId);

	@EntityGraph(attributePaths = "lineItems")
	Optional<Quotation> findByTransportOrderId(UUID transportOrderId);
}
