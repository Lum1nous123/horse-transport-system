package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.UUID;

public record RoutePlanReviewResponse(
		UUID id,
		UUID routePlanId,
		Integer submissionNo,
		RoutePlanReviewDecision decision,
		UUID submittedBy,
		LocalDateTime submittedAt,
		UUID decidedBy,
		LocalDateTime decidedAt,
		String returnReason) {

	public static RoutePlanReviewResponse from(RoutePlanReview review) {
		return new RoutePlanReviewResponse(
				review.getId(),
				review.getRoutePlanId(),
				review.getSubmissionNo(),
				review.getDecision(),
				review.getSubmittedBy(),
				review.getSubmittedAt(),
				review.getDecidedBy(),
				review.getDecidedAt(),
				review.getReturnReason());
	}
}
