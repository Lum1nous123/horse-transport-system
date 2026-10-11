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
@RequestMapping("/api/v1/orders/{orderId}/remaining-balance")
public class RemainingBalancePaymentController {

	private final RemainingBalancePaymentService paymentService;

	public RemainingBalancePaymentController(RemainingBalancePaymentService paymentService) {
		this.paymentService = paymentService;
	}

	@PostMapping("/checkout")
	@ResponseStatus(HttpStatus.CREATED)
	public RemainingBalanceCheckoutResponse createCheckout(@PathVariable UUID orderId) {
		return paymentService.createCheckout(orderId);
	}

	@GetMapping
	public RemainingBalanceResponse getRemainingBalance(@PathVariable UUID orderId) {
		return paymentService.getRemainingBalance(orderId);
	}
}
