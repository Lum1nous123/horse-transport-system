package com.horsetransport.route;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PutMapping;


@RestController
@RequestMapping("/api/v1/frc/orders/{orderId}/route-plan")
public class RoutePlanController {

	private final RoutePlanService routePlanService;

	public RoutePlanController(RoutePlanService routePlanService) {
		this.routePlanService = routePlanService;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public RoutePlanResponse createPlan(@PathVariable UUID orderId) {
		return routePlanService.createPlan(orderId);
	}

	@GetMapping
	public RoutePlanResponse getPlan(@PathVariable UUID orderId) {
		return routePlanService.getPlan(orderId);
	}

    @GetMapping("/legs/{legId}/vehicle-candidates")
public List<VehicleCandidateResponse> listVehicleCandidates(@PathVariable UUID orderId,
		@PathVariable UUID legId) {
	return routePlanService.listVehicleCandidates(orderId, legId);
}

@GetMapping("/legs/{legId}/vehicles")
public RoadAllocationDetailResponse getRoadAllocation(@PathVariable UUID orderId,
		@PathVariable UUID legId) {
	return routePlanService.getRoadAllocation(orderId, legId);
}

@PutMapping("/legs/{legId}/vehicles")
public RoadAllocationDetailResponse allocateRoadVehicles(@PathVariable UUID orderId,
		@PathVariable UUID legId,
		@Valid @RequestBody RoadVehicleAllocationRequest request) {
	return routePlanService.allocateRoadVehicles(orderId, legId, request);
}



@GetMapping("/legs/{legId}/checkpoints")
public List<CheckpointResponse> getCheckpoints(@PathVariable UUID orderId,
		@PathVariable UUID legId) {
	return routePlanService.getCheckpoints(orderId, legId);
}

@PutMapping("/legs/{legId}/checkpoints")
public List<CheckpointResponse> updateCheckpoints(@PathVariable UUID orderId,
		@PathVariable UUID legId,
		@Valid @RequestBody UpdateCheckpointsRequest request) {
	return routePlanService.updateCheckpoints(orderId, legId, request);
}

	@PostMapping("/legs")
	@ResponseStatus(HttpStatus.CREATED)
	public RouteLegResponse addLeg(@PathVariable UUID orderId,
			@Valid @RequestBody UpsertRouteLegRequest request) {
		return routePlanService.addLeg(orderId, request);
	}
    	@PutMapping("/legs/{legId}")
	public RouteLegResponse updateLeg(@PathVariable UUID orderId,
			@PathVariable UUID legId,
			@Valid @RequestBody UpsertRouteLegRequest request) {
		return routePlanService.updateLeg(orderId, legId, request);
	}

	@DeleteMapping("/legs/{legId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteLeg(@PathVariable UUID orderId, @PathVariable UUID legId) {
		routePlanService.deleteLeg(orderId, legId);
	}
    @PutMapping("/legs/reorder")
	public RoutePlanResponse reorderLegs(@PathVariable UUID orderId,
		@Valid @RequestBody ReorderRouteLegRequest request) {
		return routePlanService.reorderLegs(orderId, request);
	}
    	@GetMapping("/validation")
	public RoutePlanValidationResponse validatePlan(@PathVariable UUID orderId) {
		return routePlanService.validatePlan(orderId);
	}
    	@PostMapping("/submit")
	public RoutePlanResponse submitPlan(@PathVariable UUID orderId) {
		return routePlanService.submitPlan(orderId);
	}
}