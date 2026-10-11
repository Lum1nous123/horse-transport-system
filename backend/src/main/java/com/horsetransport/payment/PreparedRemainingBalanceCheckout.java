package com.horsetransport.payment;

record PreparedRemainingBalanceCheckout(Payment payment, PaymentAttempt attempt, StripeCheckoutCommand command) {
}
