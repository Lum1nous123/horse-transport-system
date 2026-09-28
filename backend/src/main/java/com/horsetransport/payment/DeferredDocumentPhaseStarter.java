package com.horsetransport.payment;

import java.util.UUID;

import org.springframework.stereotype.Component;

@Component
public class DeferredDocumentPhaseStarter implements DocumentPhaseStarter {

	@Override
	public void startForOrder(UUID orderId) {
		// BE-06 supplies checklist generation behind this transaction-boundary hook.
	}
}
