package com.horsetransport.document;

import java.net.URI;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.UUID;

public record DocumentVersionResponse(
		UUID id,
		UUID documentId,
		int versionNo,
		DocumentVersionStatus status,
		boolean isCurrent,
		String fileUrl,
		String displayName,
		LocalDate expiryDate,
		LocalDateTime uploadedAt,
		LocalDateTime submittedAt,
		LocalDateTime reviewedAt,
		String rejectionReason) {

	static DocumentVersionResponse from(HorseDocumentVersion version) {
		return new DocumentVersionResponse(version.getId(), version.getHorseDocumentId(), version.getVersionNo(),
				version.getStatus(), version.isCurrent(), version.getFileUrl(), displayName(version), version.getExpiryDate(),
				version.getUploadedAt(), version.getSubmittedAt(), version.getReviewedAt(),
				version.getRejectionReason());
	}

	private static String displayName(HorseDocumentVersion version) {
		String baseName = switch (version.getDocumentType()) {
			case HORSE_PASSPORT_OR_IDENTIFICATION -> "horse-passport";
			case VACCINATION_CERTIFICATE -> "vaccination-certificate";
			case VETERINARY_HEALTH_CERTIFICATE -> "veterinary-health-certificate";
			case OWNERSHIP_CERTIFICATE -> "ownership-certificate";
			case EXPORT_IMPORT_PERMIT -> "export-import-permit";
		};
		return baseName + extension(version.getFileUrl());
	}

	private static String extension(String fileUrl) {
		try {
			String path = URI.create(fileUrl).getPath();
			int slash = path.lastIndexOf('/');
			int dot = path.lastIndexOf('.');
			if (dot > slash && dot < path.length() - 1) {
				String extension = path.substring(dot).toLowerCase(Locale.ROOT);
				if (extension.equals(".pdf") || extension.equals(".png") || extension.equals(".jpg")
						|| extension.equals(".jpeg")) return extension;
			}
		}
		catch (IllegalArgumentException ignored) {
			// A valid storage URL is enforced before persistence; keep a safe display fallback.
		}
		return "";
	}
}
