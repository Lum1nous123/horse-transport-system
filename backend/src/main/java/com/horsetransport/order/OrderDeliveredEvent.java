package com.horsetransport.order;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Transactional contract consumed by BE-27 after final delivery succeeds.
 * Consumers that persist side effects must run synchronously in the publishing
 * transaction (or in BEFORE_COMMIT) so a failure rolls the delivery back.
 */
public record OrderDeliveredEvent(
		UUID orderId,
		UUID customerId,
		UUID finalRouteLegId,
		LocalDateTime deliveredAt) {
}
