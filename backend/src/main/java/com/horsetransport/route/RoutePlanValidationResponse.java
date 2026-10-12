package com.horsetransport.route;

import java.util.List;

public record RoutePlanValidationResponse(
		boolean valid,
		List<RoutePlanValidationIssueResponse> issues) {

	public static RoutePlanValidationResponse passed() {
		return new RoutePlanValidationResponse(true, List.of());
	}

	public static RoutePlanValidationResponse failed(List<RoutePlanValidationIssueResponse> issues) {
		return new RoutePlanValidationResponse(false, List.copyOf(issues));
	}
}
