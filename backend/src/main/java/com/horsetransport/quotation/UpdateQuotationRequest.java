package com.horsetransport.quotation;

import java.math.BigDecimal;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Positive;

public record UpdateQuotationRequest(
		@Positive @Digits(integer = 10, fraction = 2) BigDecimal depositAmount,
		String notes,
		List<@Valid QuotationLineItemRequest> lineItems) {

	public List<QuotationLineItemRequest> safeLineItems() {
		return lineItems == null ? List.of() : List.copyOf(lineItems);
	}
}
