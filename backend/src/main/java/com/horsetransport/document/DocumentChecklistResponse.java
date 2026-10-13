package com.horsetransport.document;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record DocumentChecklistResponse(UUID orderId, LocalDateTime documentCompletionDeadlineAt,
		LocalDateTime documentDeadlineSetAt, boolean canFinalConfirm, UUID documentsFinalConfirmedBy,
		LocalDateTime documentsFinalConfirmedAt, LocalDateTime documentsLockedAt,
		List<HorseDocumentChecklistResponse> horses) {
}
