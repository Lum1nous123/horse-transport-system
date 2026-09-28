package com.horsetransport.payment;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentProviderEventRepository extends JpaRepository<PaymentProviderEvent, UUID> {

	boolean existsByProviderEventId(String providerEventId);
}
