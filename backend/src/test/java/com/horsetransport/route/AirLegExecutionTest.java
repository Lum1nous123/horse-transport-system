package com.horsetransport.route;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDateTime;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class AirLegExecutionTest {

	private static final LocalDateTime STARTED_AT =
			LocalDateTime.of(2026, 10, 21, 9, 30);
	private static final LocalDateTime ARRIVED_AT =
			LocalDateTime.of(2026, 10, 21, 15, 30);
	private static final LocalDateTime COMPLETED_AT =
			LocalDateTime.of(2026, 10, 21, 16, 0);

	@Test
	void startsFromNotStarted() {
		// Tạo một AIR execution chưa bắt đầu
		AirLegExecution execution =
				new AirLegExecution(UUID.randomUUID(), UUID.randomUUID());

		// Bắt đầu chuyến AIR tại thời gian cố định
		execution.start(STARTED_AT);

		// Kiểm tra trạng thái và thời gian bắt đầu
		assertThat(execution.getStatus()).isEqualTo(ExecutionStatus.IN_PROGRESS);
		assertThat(execution.getStartedAt()).isEqualTo(STARTED_AT);
	}

	@Test
	void rejectsStartingTwiceWithoutChangingOriginalTime() {
		AirLegExecution execution =
				new AirLegExecution(UUID.randomUUID(), UUID.randomUUID());
		execution.start(STARTED_AT);

		// Không cho phép bắt đầu lại một AIR execution đang thực hiện
		assertThatThrownBy(() -> execution.start(STARTED_AT.plusMinutes(5)))
				.isInstanceOf(RoutePlanValidationException.class)
				.hasMessage("AIR leg execution has already started");

		// Lần gọi sai không được ghi đè trạng thái hoặc thời gian ban đầu
		assertThat(execution.getStatus()).isEqualTo(ExecutionStatus.IN_PROGRESS);
		assertThat(execution.getStartedAt()).isEqualTo(STARTED_AT);
	}

	@Test
	void arrivesAtDestinationFromInProgress() {
		AirLegExecution execution =
				new AirLegExecution(UUID.randomUUID(), UUID.randomUUID());
		execution.start(STARTED_AT);

		// Ghi nhận thời điểm chuyến AIR đến đích
		execution.arriveAtDestination(ARRIVED_AT);

		assertThat(execution.getStatus()).isEqualTo(ExecutionStatus.DESTINATION);
		assertThat(execution.getDestinationArrivedAt()).isEqualTo(ARRIVED_AT);
	}

	@Test
	void rejectsDestinationArrivalBeforeStart() {
		AirLegExecution execution =
				new AirLegExecution(UUID.randomUUID(), UUID.randomUUID());

		// Không cho phép ghi nhận đến đích khi chuyến AIR chưa bắt đầu
		assertThatThrownBy(() -> execution.arriveAtDestination(ARRIVED_AT))
				.isInstanceOf(RoutePlanValidationException.class)
				.hasMessage("AIR leg must be in progress before destination arrival");

		assertThat(execution.getStatus()).isEqualTo(ExecutionStatus.NOT_STARTED);
		assertThat(execution.getDestinationArrivedAt()).isNull();
	}

	@Test
	void completesFromDestination() {
		AirLegExecution execution =
				new AirLegExecution(UUID.randomUUID(), UUID.randomUUID());
		execution.start(STARTED_AT);
		execution.arriveAtDestination(ARRIVED_AT);

		// Hoàn tất chuyến AIR sau khi đã đến đích
		execution.complete(COMPLETED_AT);

		assertThat(execution.getStatus()).isEqualTo(ExecutionStatus.COMPLETED);
		assertThat(execution.getCompletedAt()).isEqualTo(COMPLETED_AT);
	}

	@Test
	void rejectsCompletionBeforeDestination() {
		AirLegExecution execution =
				new AirLegExecution(UUID.randomUUID(), UUID.randomUUID());
		execution.start(STARTED_AT);

		// Không cho phép hoàn tất khi chuyến AIR chưa đến đích
		assertThatThrownBy(() -> execution.complete(COMPLETED_AT))
				.isInstanceOf(RoutePlanValidationException.class)
				.hasMessage("AIR leg requires destination arrival and final welfare to complete");

		assertThat(execution.getStatus()).isEqualTo(ExecutionStatus.IN_PROGRESS);
		assertThat(execution.getCompletedAt()).isNull();
	}

	@Test
	void rejectsCompletingTwiceWithoutChangingOriginalTime() {
		AirLegExecution execution =
				new AirLegExecution(UUID.randomUUID(), UUID.randomUUID());
		execution.start(STARTED_AT);
		execution.arriveAtDestination(ARRIVED_AT);
		execution.complete(COMPLETED_AT);

		// Không cho phép hoàn tất cùng một AIR execution hai lần
		assertThatThrownBy(() -> execution.complete(COMPLETED_AT.plusMinutes(5)))
				.isInstanceOf(RoutePlanValidationException.class)
				.hasMessage("AIR leg requires destination arrival and final welfare to complete");

		assertThat(execution.getStatus()).isEqualTo(ExecutionStatus.COMPLETED);
		assertThat(execution.getCompletedAt()).isEqualTo(COMPLETED_AT);
	}
}
