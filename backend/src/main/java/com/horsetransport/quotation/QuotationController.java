package com.horsetransport.quotation;

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
@RequestMapping("/api/v1/orders/{orderId}/quotation")
public class QuotationController {

	private final QuotationService quotationService;

	public QuotationController(QuotationService quotationService) {
		this.quotationService = quotationService;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public QuotationResponse create(@PathVariable UUID orderId) {
		return quotationService.create(orderId);
	}

	@PutMapping
	public QuotationResponse update(@PathVariable UUID orderId,
			@Valid @RequestBody UpdateQuotationRequest request) {
		return quotationService.update(orderId, request);
	}

	@GetMapping
	public QuotationResponse get(@PathVariable UUID orderId) {
		return quotationService.get(orderId);
	}

	@PostMapping("/send")
	public QuotationResponse send(@PathVariable UUID orderId) {
		return quotationService.send(orderId);
	}
}
