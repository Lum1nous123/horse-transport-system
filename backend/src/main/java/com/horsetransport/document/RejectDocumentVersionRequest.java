package com.horsetransport.document;

import jakarta.validation.constraints.NotBlank;

public record RejectDocumentVersionRequest(
		@NotBlank(message = "must not be blank") String rejectionReason) {
}
