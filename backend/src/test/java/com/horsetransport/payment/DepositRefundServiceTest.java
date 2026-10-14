package com.horsetransport.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DepositRefundServiceTest {
	@Mock private DepositRefundRepository refunds;
	@Mock private DepositRefundProcessor processor;
	private final Clock clock = Clock.fixed(Instant.parse("2026-10-04T10:00:00Z"), ZoneOffset.UTC);
	private DepositRefundService service;

	@BeforeEach
	void setUp() {
		service = new DepositRefundService(refunds, processor, clock);
	}

	@Test
	void dueRefundFailureDoesNotStopRemainingRefunds() {
		UUID first = UUID.randomUUID();
		UUID second = UUID.randomUUID();
		when(refunds.findDueIds(LocalDateTime.now(clock), org.springframework.data.domain.PageRequest.of(0, 100)))
				.thenReturn(List.of(first, second));
		doThrow(new IllegalStateException("database unavailable")).when(processor).processOne(first);

		int selected = service.processDueRefunds();

		assertThat(selected).isEqualTo(2);
		InOrder processingOrder = inOrder(processor);
		processingOrder.verify(processor).processOne(first);
		processingOrder.verify(processor).processOne(second);
	}

	@Test
	void refundWebhookIsDelegatedThroughProcessorBean() {
		StripeWebhookEvent event = org.mockito.Mockito.mock(StripeWebhookEvent.class);
		WebhookProcessingResult expected = new WebhookProcessingResult(true, false, false);
		when(processor.processRefundWebhook(event)).thenReturn(expected);

		assertThat(service.processRefundWebhook(event)).isSameAs(expected);
		verify(processor).processRefundWebhook(event);
	}
}
