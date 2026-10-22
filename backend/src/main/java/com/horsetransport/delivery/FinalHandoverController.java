package com.horsetransport.delivery;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class FinalHandoverController {

	private final FinalHandoverService handoverService;

	public FinalHandoverController(FinalHandoverService handoverService) {
		this.handoverService = handoverService;
	}

	@PostMapping(value = "/api/v1/road-executions/vehicles/{roadLegVehicleId}/proof-of-delivery",
			consumes = "multipart/form-data")
	@ResponseStatus(HttpStatus.CREATED)
	public ProofOfDeliveryResponse recordRoadHandover(@PathVariable UUID roadLegVehicleId,
			@RequestParam("recipientName") String recipientName,
			@RequestParam("photo") MultipartFile photo,
			@RequestParam(value = "note", required = false) String note) {
		return handoverService.recordRoadHandover(roadLegVehicleId, recipientName, photo, note);
	}

	@PostMapping(value = "/api/v1/air-executions/legs/{routeLegId}/proof-of-delivery",
			consumes = "multipart/form-data")
	@ResponseStatus(HttpStatus.CREATED)
	public ProofOfDeliveryResponse recordAirHandover(@PathVariable UUID routeLegId,
			@RequestParam("recipientName") String recipientName,
			@RequestParam("photo") MultipartFile photo,
			@RequestParam(value = "note", required = false) String note) {
		return handoverService.recordAirHandover(routeLegId, recipientName, photo, note);
	}
}
