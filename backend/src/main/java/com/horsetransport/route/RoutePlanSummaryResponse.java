package com.horsetransport.route;

import java.util.UUID;

public record RoutePlanSummaryResponse(
		UUID routePlanId,
		RoutePlanStatus status,
		boolean editableByFrc) {

	public static RoutePlanSummaryResponse from(RoutePlan routePlan) {
		if (routePlan == null) {
			return new RoutePlanSummaryResponse(null, null, true);
		}
		return new RoutePlanSummaryResponse(
				routePlan.getId(),
				routePlan.getStatus(),
				routePlan.isEditableByFrc());
	}
}
