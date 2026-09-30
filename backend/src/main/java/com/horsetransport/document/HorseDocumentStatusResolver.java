package com.horsetransport.document;

import java.util.List;

import com.horsetransport.order.OrderHorseDocumentStatus;

final class HorseDocumentStatusResolver {

	private HorseDocumentStatusResolver() {
	}

	static OrderHorseDocumentStatus resolve(List<HorseDocumentVersion> currentVersions) {
		if (currentVersions.stream().anyMatch(version ->
				version.getStatus() == DocumentVersionStatus.REJECTED)) {
			return OrderHorseDocumentStatus.NEEDS_REVISION;
		}

		if (currentVersions.size() != DocumentType.values().length) {
			return OrderHorseDocumentStatus.INCOMPLETE;
		}

		if (currentVersions.stream().allMatch(version ->
				version.getStatus() == DocumentVersionStatus.APPROVED)) {
			return OrderHorseDocumentStatus.ELIGIBLE_FOR_EXPORT;
		}

		if (currentVersions.stream().allMatch(version ->
				version.getStatus() == DocumentVersionStatus.PENDING_REVIEW
						|| version.getStatus() == DocumentVersionStatus.APPROVED)) {
			return OrderHorseDocumentStatus.UNDER_REVIEW;
		}

		return OrderHorseDocumentStatus.INCOMPLETE;
	}
}
