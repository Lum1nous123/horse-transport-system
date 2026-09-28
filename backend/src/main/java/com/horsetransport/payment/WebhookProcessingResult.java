package com.horsetransport.payment;

record WebhookProcessingResult(boolean processed, boolean duplicate, boolean orderApproved) {
}
