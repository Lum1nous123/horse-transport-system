package com.horsetransport.document;

import java.time.LocalDateTime;

import jakarta.validation.constraints.NotNull;

public record SetDocumentDeadlineRequest(
		@NotNull LocalDateTime documentCompletionDeadlineAt) {
}
