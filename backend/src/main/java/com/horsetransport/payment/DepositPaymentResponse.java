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
		LocalDateTime refundedAt,
		String refundStatus,
		LocalDateTime refundNextAttemptAt,
		PaymentAttemptResponse latestAttempt) {

	static DepositPaymentResponse from(Payment payment, PaymentAttempt attempt, DepositRefund refund) {
		return new DepositPaymentResponse(payment.getId(), payment.getTransportOrderId(), payment.getPaymentType(),
				payment.getAmount(), payment.getCurrency(), payment.getStatus(), payment.getPaidAt(), payment.getRefundedAt(),
				refund == null ? null : refund.getProviderStatus(), refund == null ? null : refund.getNextAttemptAt(),
				PaymentAttemptResponse.from(attempt));
	}

	public DepositPaymentResponse(UUID id, UUID orderId, PaymentType paymentType, BigDecimal amount,
			String currency, PaymentStatus status, LocalDateTime paidAt, PaymentAttemptResponse latestAttempt) {
		this(id, orderId, paymentType, amount, currency, status, paidAt, null, null, null, latestAttempt);
	}
}
