package com.horsetransport.payment;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record DepositPaymentResponse(
		UUID id,
		UUID orderId,
		PaymentType paymentType,
		BigDecimal amount,
		String currency,
		PaymentStatus status,
		LocalDateTime paidAt,
		PaymentAttemptResponse latestAttempt) {

	static DepositPaymentResponse from(Payment payment, PaymentAttempt attempt) {
		return new DepositPaymentResponse(payment.getId(), payment.getTransportOrderId(), payment.getPaymentType(),
				payment.getAmount(), payment.getCurrency(), payment.getStatus(), payment.getPaidAt(),
				PaymentAttemptResponse.from(attempt));
	}
}
