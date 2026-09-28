package com.horsetransport.quotation;

import java.math.BigDecimal;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record QuotationLineItemRequest(
		@NotNull @Positive Integer sequenceNo,
		@NotBlank @Size(max = 255) String description,
		@NotNull @Positive @Digits(integer = 10, fraction = 2) BigDecimal amount) {
}
