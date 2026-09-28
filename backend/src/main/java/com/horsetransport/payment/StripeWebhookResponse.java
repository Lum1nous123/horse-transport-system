package com.horsetransport.payment;

public record StripeWebhookResponse(boolean processed, boolean duplicate, boolean orderApproved) {
}
