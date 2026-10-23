package com.horsetransport.notification;

import java.util.UUID;

public final class NotificationEventCatalog {

	private NotificationEventCatalog() {
	}

	public static String tripStarted(UUID orderId) {
		return "trip-started:order:" + orderId;
	}

	public static String checkpointReached(UUID arrivalId) {
		return "checkpoint-reached:arrival:" + arrivalId;
	}

	public static String welfareUpdated(UUID evidenceId) {
		return "welfare-updated:evidence:" + evidenceId;
	}

	public static String routeLegCompleted(UUID routeLegId) {
		return "route-leg-completed:leg:" + routeLegId;
	}

	public static String roadFinalDestinationReached(UUID executionId) {
		return "final-destination:road-execution:" + executionId;
	}

	public static String airFinalDestinationReached(UUID executionId) {
		return "final-destination:air-execution:" + executionId;
	}

	public static String orderDelivered(UUID orderId) {
		return "order-delivered:order:" + orderId;
	}

	public static String paymentPaid(UUID paymentId) {
		return "payment-result:payment:" + paymentId + ":paid";
	}

	public static String refundSucceeded(UUID refundId) {
		return "refund-" + refundId + "-success";
	}

	public static String refundFailed(UUID refundId, int retryCount) {
		return "refund-" + refundId + "-failure-" + retryCount;
	}
}
