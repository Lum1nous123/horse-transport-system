package com.horsetransport.route;

import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class ExecutionReadController {

	private final ExecutionReadService service;

	public ExecutionReadController(ExecutionReadService service) {
		this.service = service;
	}

	@GetMapping("/road-executions/assigned")
	public RoadExecutionReadResponse.Queue assignedRoad() {
		return service.assignedRoad();
	}

	@GetMapping("/road-executions/{executionId}")
	public RoadExecutionReadResponse.Detail roadDetail(@PathVariable UUID executionId) {
		return service.roadDetail(executionId);
	}

	@GetMapping("/air-executions/assigned")
	public AirExecutionReadResponse.Queue assignedAir() {
		return service.assignedAir();
	}

	@GetMapping("/air-executions/{executionId}")
	public AirExecutionReadResponse.Detail airDetail(@PathVariable UUID executionId) {
		return service.airDetail(executionId);
	}
}
