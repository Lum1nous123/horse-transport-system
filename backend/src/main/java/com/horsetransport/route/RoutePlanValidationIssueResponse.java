package com.horsetransport.route;

import java.util.UUID;

public record RoutePlanValidationIssueResponse(
		String code,
		String message,
		UUID routeLegId,
		Integer sequenceNo) {
}
