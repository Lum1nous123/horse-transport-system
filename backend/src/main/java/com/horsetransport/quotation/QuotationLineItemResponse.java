package com.horsetransport.quotation;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record QuotationLineItemResponse(
		UUID id,
		int sequenceNo,
		String description,
		BigDecimal amount,
		LocalDateTime createdAt,
		LocalDateTime updatedAt) {

	static QuotationLineItemResponse from(QuotationLineItem item) {
		return new QuotationLineItemResponse(item.getId(), item.getSequenceNo(), item.getDescription(),
				item.getAmount(), item.getCreatedAt(), item.getUpdatedAt());
	}
}
