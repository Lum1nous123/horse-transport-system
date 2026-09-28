package com.horsetransport.payment;

record PreparedDepositCheckout(Payment payment, PaymentAttempt attempt, StripeCheckoutCommand command) {
}
