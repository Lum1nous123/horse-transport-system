package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.UUID;

public record LmRoutePlanReviewInboxResponse(
		UUID reviewId,
		UUID routePlanId,
		UUID transportOrderId,
		Integer submissionNo,
		UUID submittedBy,
		LocalDateTime submittedAt,
		RoutePlanStatus status) {

	public static LmRoutePlanReviewInboxResponse from(RoutePlanReview review, RoutePlan routePlan) {
		return new LmRoutePlanReviewInboxResponse(
				review.getId(),
				routePlan.getId(),
				routePlan.getTransportOrderId(),
				review.getSubmissionNo(),
				review.getSubmittedBy(),
				review.getSubmittedAt(),
				routePlan.getStatus());
	}
}
