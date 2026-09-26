package com.horsetransport.order;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/orders")
public class TransportOrderController {

	private final TransportOrderService orderService;

	public TransportOrderController(TransportOrderService orderService) {
		this.orderService = orderService;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public OrderResponse create(@Valid @RequestBody UpdateOrderRequest request) {
		return orderService.create(request);
	}

	@GetMapping
	public List<OrderResponse> list() {
		return orderService.findCurrentCustomerOrders();
	}

	@GetMapping("/{orderId}")
	public OrderResponse detail(@PathVariable UUID orderId) {
		return orderService.findCurrentCustomerOrder(orderId);
	}

	@PutMapping("/{orderId}")
	public OrderResponse update(@PathVariable UUID orderId, @Valid @RequestBody UpdateOrderRequest request) {
		return orderService.update(orderId, request);
	}

	@PostMapping("/{orderId}/submit")
	public OrderResponse submit(@PathVariable UUID orderId) {
		return orderService.submit(orderId);
	}
}
