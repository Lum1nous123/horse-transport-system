package com.horsetransport.payment;

import java.util.UUID;

public interface DocumentPhaseStarter {

	void startForOrder(UUID orderId);
}
