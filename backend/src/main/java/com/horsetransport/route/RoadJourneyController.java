package com.horsetransport.route;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/road-executions/vehicles/{roadLegVehicleId}")
public class RoadJourneyController {

	private final RoadJourneyService journeyService;

	public RoadJourneyController(RoadJourneyService journeyService) {
		this.journeyService = journeyService;
	}

	@PostMapping("/start")
	public RoadExecutionResponse start(@PathVariable UUID roadLegVehicleId) {
		return journeyService.start(roadLegVehicleId);
	}

	@PostMapping("/checkpoints/{checkpointId}/arrival")
	@ResponseStatus(HttpStatus.CREATED)
	public CheckpointArrivalResponse arriveAtCheckpoint(@PathVariable UUID roadLegVehicleId,
			@PathVariable UUID checkpointId) {
		return journeyService.arriveAtCheckpoint(roadLegVehicleId, checkpointId);
	}

	@PostMapping("/destination")
	public RoadExecutionResponse arriveAtDestination(@PathVariable UUID roadLegVehicleId) {
		return journeyService.arriveAtDestination(roadLegVehicleId);
	}

	@PostMapping(value = "/checkpoints/{checkpointId}/welfare", consumes = "multipart/form-data")
	@ResponseStatus(HttpStatus.CREATED)
	public WelfareEvidenceResponse recordCheckpointWelfare(@PathVariable UUID roadLegVehicleId,
			@PathVariable UUID checkpointId, @RequestParam("photo") MultipartFile photo,
			@RequestParam("note") String note) {
		return journeyService.recordCheckpointWelfare(roadLegVehicleId, checkpointId, photo, note);
	}

	@PostMapping(value = "/destination/welfare", consumes = "multipart/form-data")
	@ResponseStatus(HttpStatus.CREATED)
	public WelfareEvidenceResponse recordFinalWelfare(@PathVariable UUID roadLegVehicleId,
			@RequestParam("photo") MultipartFile photo, @RequestParam("note") String note) {
		return journeyService.recordFinalWelfare(roadLegVehicleId, photo, note);
	}
}
