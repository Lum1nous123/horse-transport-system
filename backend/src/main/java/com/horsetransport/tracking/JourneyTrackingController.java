package com.horsetransport.tracking;

import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/orders/{orderId}/tracking")
public class JourneyTrackingController {

	private final JourneyTrackingService trackingService;

	public JourneyTrackingController(JourneyTrackingService trackingService) {
		this.trackingService = trackingService;
	}

	@GetMapping
	public JourneyTrackingResponse getTracking(@PathVariable UUID orderId) {
		return trackingService.getTracking(orderId);
	}
}
