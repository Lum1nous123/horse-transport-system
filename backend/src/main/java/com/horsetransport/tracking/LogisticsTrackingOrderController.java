package com.horsetransport.tracking;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/lm/tracking-orders")
public class LogisticsTrackingOrderController {
	private final LogisticsTrackingOrderService service;
	public LogisticsTrackingOrderController(LogisticsTrackingOrderService service) { this.service = service; }
	@GetMapping
	public List<LogisticsTrackingOrderResponse> list() { return service.list(); }
}
