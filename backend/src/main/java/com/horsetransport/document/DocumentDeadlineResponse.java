package com.horsetransport.document;

import java.time.LocalDateTime;
import java.util.UUID;

public record DocumentDeadlineResponse(UUID orderId, LocalDateTime documentCompletionDeadlineAt,
		LocalDateTime documentDeadlineSetAt) {
}
