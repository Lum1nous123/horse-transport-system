package com.horsetransport.route;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.UUID;
import org.springframework.web.bind.annotation.PathVariable;

@RestController
@RequestMapping("/api/v1/frc")
public class FrcPlanningController {

	private final FrcPlanningService planningService;

	public FrcPlanningController(FrcPlanningService planningService) {
		this.planningService = planningService;
	}

	@GetMapping("/planning-queue")
	public List<FrcPlanningQueueItemResponse> getPlanningQueue() {
		return planningService.getPlanningQueue();
	}
    	@GetMapping("/orders/{orderId}/planning-context")
	public FrcPlanningContextResponse getPlanningContext(@PathVariable UUID orderId) {
		return planningService.getPlanningContext(orderId);
	}
}
