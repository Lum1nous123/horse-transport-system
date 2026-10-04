package com.horsetransport.document;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import com.horsetransport.order.TransportOrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DocumentDeadlineServiceTest {

	private static final UUID ORDER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 4, 12, 0);

	@Mock private TransportOrderRepository orderRepository;
	@Mock private DocumentDeadlineOrderProcessor orderProcessor;

	@Test
	void scansAtInjectedClockTimeAndReturnsPersistedDecisionCount() {
		Clock clock = Clock.fixed(Instant.parse("2026-10-04T12:00:00Z"), ZoneOffset.UTC);
		DocumentDeadlineService service = new DocumentDeadlineService(orderRepository, orderProcessor, clock);
		when(orderRepository.findDueDocumentDeadlineOrderIds(NOW)).thenReturn(List.of(ORDER_ID));
		when(orderProcessor.cancelForIncompleteDeadline(ORDER_ID, NOW)).thenReturn(true);

		assertThat(service.evaluateDueOrders()).isEqualTo(new DocumentDeadlineEvaluationResult(1, 1));
		verify(orderRepository).findDueDocumentDeadlineOrderIds(NOW);
		verify(orderProcessor).cancelForIncompleteDeadline(ORDER_ID, NOW);
	}

	@Test
	void lateRejectionUsesSameInjectedClock() {
		Clock clock = Clock.fixed(Instant.parse("2026-10-04T12:00:00Z"), ZoneOffset.UTC);
		DocumentDeadlineService service = new DocumentDeadlineService(orderRepository, orderProcessor, clock);
		when(orderProcessor.cancelForPostDeadlineRejection(ORDER_ID, NOW)).thenReturn(true);

		assertThat(service.handlePostDeadlineRejection(ORDER_ID)).isTrue();
		verify(orderProcessor).cancelForPostDeadlineRejection(ORDER_ID, NOW);
	}
}
