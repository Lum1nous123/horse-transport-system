package com.horsetransport.quotation;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record QuotationResponse(
		UUID id,
		UUID orderId,
		BigDecimal totalAmount,
		BigDecimal depositAmount,
		BigDecimal remainingAmount,
		String currency,
		String notes,
		QuotationStatus status,
		UUID createdBy,
		LocalDateTime sentAt,
		LocalDateTime createdAt,
		LocalDateTime updatedAt,
		List<QuotationLineItemResponse> lineItems) {

	static QuotationResponse from(Quotation quotation) {
		return new QuotationResponse(quotation.getId(), quotation.getTransportOrderId(),
				quotation.getTotalAmount(), quotation.getDepositAmount(), quotation.getRemainingAmount(),
				quotation.getCurrency(), quotation.getNotes(), quotation.getStatus(), quotation.getCreatedBy(),
				quotation.getSentAt(), quotation.getCreatedAt(), quotation.getUpdatedAt(),
				quotation.getLineItems().stream().map(QuotationLineItemResponse::from).toList());
	}
}
