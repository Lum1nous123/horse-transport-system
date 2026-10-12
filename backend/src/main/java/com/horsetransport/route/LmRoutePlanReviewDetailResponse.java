package com.horsetransport.route;

import com.horsetransport.order.OrderStatus;

public record LmRoutePlanReviewDetailResponse(
		RoutePlanResponse routePlan,
		RoutePlanReviewResponse review,
		ExecutionStaffingResponse executionStaffing,
		OrderStatus orderStatus) {
}
