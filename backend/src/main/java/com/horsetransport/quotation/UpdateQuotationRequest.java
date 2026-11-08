package com.horsetransport.quotation;

import java.math.BigDecimal;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Positive;

public record UpdateQuotationRequest(
		@Positive @Digits(integer = 10, fraction = 2) BigDecimal totalAmount,
		String notes) {
}
