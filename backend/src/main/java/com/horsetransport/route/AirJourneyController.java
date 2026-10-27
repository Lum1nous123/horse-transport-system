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
@RequestMapping("/api/v1/air-executions/legs/{routeLegId}")
public class AirJourneyController {

	private final AirJourneyService journeyService;

	public AirJourneyController(AirJourneyService journeyService) {
		this.journeyService = journeyService;
	}

	@PostMapping("/start")
	public AirExecutionResponse start(@PathVariable UUID routeLegId) {
		return journeyService.start(routeLegId);
	}

	@PostMapping("/destination")
	public AirExecutionResponse arriveAtDestination(@PathVariable UUID routeLegId) {
		return journeyService.arriveAtDestination(routeLegId);
	}

	@PostMapping(value = "/destination/welfare", consumes = "multipart/form-data")
	@ResponseStatus(HttpStatus.CREATED)
	public WelfareEvidenceResponse recordFinalWelfare(@PathVariable UUID routeLegId,
			@RequestParam("photo") MultipartFile photo, @RequestParam("note") String note) {
		return journeyService.recordFinalWelfare(routeLegId, photo, note);
	}

	@PostMapping("/complete")
	public AirExecutionResponse complete(@PathVariable UUID routeLegId) {
		return journeyService.complete(routeLegId);
	}
}
