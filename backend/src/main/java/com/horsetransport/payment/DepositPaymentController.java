package com.horsetransport.payment;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/orders/{orderId}/deposit")
public class DepositPaymentController {

	private final DepositPaymentService paymentService;

	public DepositPaymentController(DepositPaymentService paymentService) {
		this.paymentService = paymentService;
	}

	@PostMapping("/checkout")
	@ResponseStatus(HttpStatus.CREATED)
	public DepositCheckoutResponse createCheckout(@PathVariable UUID orderId) {
		return paymentService.createCheckout(orderId);
	}

	@GetMapping
	public DepositPaymentResponse getDeposit(@PathVariable UUID orderId) {
		return paymentService.getDeposit(orderId);
	}
}
