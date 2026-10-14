package com.horsetransport.route;

import java.util.List;

import com.horsetransport.order.OrderStatus;

public record LmRoutePlanReviewDetailResponse(
		RoutePlanResponse routePlan,
		RoutePlanReviewResponse review,
		List<RoadAllocationDetailResponse> roadAllocations,
		ExecutionStaffingResponse executionStaffing,
		OrderStatus orderStatus) {
}
