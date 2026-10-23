package com.horsetransport.notification;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;

import org.junit.jupiter.api.Test;

class NotificationEventCatalogTest {

	@Test
	void freezesAllApprovedSourceEventKeyFormats() {
		UUID id = UUID.fromString("11111111-1111-1111-1111-111111111111");

		assertThat(NotificationEventCatalog.tripStarted(id)).isEqualTo("trip-started:order:" + id);
		assertThat(NotificationEventCatalog.checkpointReached(id)).isEqualTo("checkpoint-reached:arrival:" + id);
		assertThat(NotificationEventCatalog.welfareUpdated(id)).isEqualTo("welfare-updated:evidence:" + id);
		assertThat(NotificationEventCatalog.routeLegCompleted(id)).isEqualTo("route-leg-completed:leg:" + id);
		assertThat(NotificationEventCatalog.roadFinalDestinationReached(id))
				.isEqualTo("final-destination:road-execution:" + id);
		assertThat(NotificationEventCatalog.airFinalDestinationReached(id))
				.isEqualTo("final-destination:air-execution:" + id);
		assertThat(NotificationEventCatalog.orderDelivered(id)).isEqualTo("order-delivered:order:" + id);
		assertThat(NotificationEventCatalog.paymentPaid(id)).isEqualTo("payment-result:payment:" + id + ":paid");
		assertThat(NotificationEventCatalog.refundSucceeded(id)).isEqualTo("refund-" + id + "-success");
		assertThat(NotificationEventCatalog.refundFailed(id, 3)).isEqualTo("refund-" + id + "-failure-3");
	}
}
