package com.horsetransport.payment;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/payments/stripe")
public class StripeWebhookController {

	private final DepositPaymentService paymentService;

	public StripeWebhookController(DepositPaymentService paymentService) {
		this.paymentService = paymentService;
	}

	@PostMapping("/webhook")
	public StripeWebhookResponse webhook(@RequestBody String payload,
			@RequestHeader(value = "Stripe-Signature", required = false) String signature) {
		return paymentService.handleWebhook(payload, signature);
	}
}
