package com.horsetransport.route;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/lm/route-plan-reviews")
public class LmRoutePlanReviewController {

	private final RoutePlanService routePlanService;

	public LmRoutePlanReviewController(RoutePlanService routePlanService) {
		this.routePlanService = routePlanService;
	}

	@GetMapping
	public List<LmRoutePlanReviewInboxResponse> listPendingReviews() {
		return routePlanService.listLmReviewInbox();
	}

	@GetMapping("/orders/{orderId}")
	public LmRoutePlanReviewDetailResponse getReviewDetail(@PathVariable UUID orderId) {
		return routePlanService.getLmReviewDetail(orderId);
	}

	@PostMapping("/orders/{orderId}/return")
	public LmRoutePlanReviewDetailResponse returnRoutePlan(@PathVariable UUID orderId,
			@Valid @RequestBody ReturnRoutePlanRequest request) {
		return routePlanService.returnRoutePlan(orderId, request);
	}

	@PostMapping("/orders/{orderId}/confirm")
	public LmRoutePlanReviewDetailResponse confirmRoutePlan(@PathVariable UUID orderId) {
		return routePlanService.confirmRoutePlan(orderId);
	}
}
