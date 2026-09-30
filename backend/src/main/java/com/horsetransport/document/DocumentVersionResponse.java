package com.horsetransport.document;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record DocumentVersionResponse(
		UUID id,
		UUID documentId,
		int versionNo,
		DocumentVersionStatus status,
		boolean isCurrent,
		String fileUrl,
		LocalDate expiryDate,
		LocalDateTime uploadedAt,
		LocalDateTime submittedAt,
		LocalDateTime reviewedAt,
		String rejectionReason) {

	static DocumentVersionResponse from(HorseDocumentVersion version) {
		return new DocumentVersionResponse(version.getId(), version.getHorseDocumentId(), version.getVersionNo(),
				version.getStatus(), version.isCurrent(), version.getFileUrl(), version.getExpiryDate(),
				version.getUploadedAt(), version.getSubmittedAt(), version.getReviewedAt(),
				version.getRejectionReason());
	}
}
