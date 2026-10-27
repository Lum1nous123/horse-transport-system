package com.horsetransport.route;

import java.net.URI;

public final class EvidenceDisplayName {

	private EvidenceDisplayName() {
	}

	public static String welfare(WelfareEvidence evidence) {
		String base = evidence.getEventType() == WelfareEventType.CHECKPOINT
				? "checkpoint-welfare" : "final-welfare";
		return base + extension(evidence.getPhotoUrl());
	}

	public static String proofOfDelivery(String url) {
		return "proof-of-delivery" + extension(url);
	}

	private static String extension(String url) {
		if (url == null || url.isBlank()) return ".jpg";
		try {
			String path = URI.create(url).getPath();
			if (path == null) return ".jpg";
			int slash = path.lastIndexOf('/');
			int dot = path.lastIndexOf('.');
			if (dot <= slash || dot == path.length() - 1) return ".jpg";
			return switch (path.substring(dot + 1).toLowerCase()) {
				case "png" -> ".png";
				case "jpeg", "jpg" -> ".jpg";
				default -> ".jpg";
			};
		}
		catch (IllegalArgumentException exception) {
			return ".jpg";
		}
	}
}
