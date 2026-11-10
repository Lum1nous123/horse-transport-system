package com.horsetransport.document;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.lang.reflect.Constructor;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.horsetransport.audit.StatusAuditLogRepository;
import com.horsetransport.notification.NotificationService;
import com.horsetransport.order.OrderHorseDocumentStatus;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderHorse;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.order.TransportSpecialistAssignmentGuard;
import com.horsetransport.payment.Payment;
import com.horsetransport.payment.PaymentRepository;
import com.horsetransport.payment.PaymentStatus;
import com.horsetransport.payment.PaymentType;
import com.horsetransport.security.CurrentUserProvider;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class DocumentDeadlineBusinessRuleTest {

	private static final UUID ORDER_ID = UUID.fromString("10000000-0000-0000-0000-000000000001");
	private static final UUID CUSTOMER_ID = UUID.fromString("10000000-0000-0000-0000-000000000002");
	private static final UUID HORSE_ID = UUID.fromString("10000000-0000-0000-0000-000000000003");
	private static final UUID TS_ID = UUID.fromString("10000000-0000-0000-0000-000000000004");

	@Test
	void testDraftAtOriginalDeadlineReturnsCancelled() {
		OrderStatus expected = OrderStatus.CANCELLED;

		ScenarioResult actual = testDeadline(
				DocumentVersionStatus.DRAFT,
				LocalDateTime.of(2026, 11, 20, 17, 0), // Original Deadline
				null,                                  // Not submitted
				LocalDateTime.of(2026, 11, 20, 17, 0), // Evaluation time
				PaymentStatus.PAID);

		assertEquals(expected, actual.orderStatus());
		assertEquals(PaymentStatus.PAID, actual.paymentStatus());
	}

	@Test
	void testPendingReviewAtOriginalDeadlineKeepsOrderActive() {
		OrderStatus expected = OrderStatus.APPROVED;

		ScenarioResult actual = testDeadline(
				DocumentVersionStatus.PENDING_REVIEW,
				LocalDateTime.of(2026, 11, 20, 17, 0),  // Original Deadline
				LocalDateTime.of(2026, 11, 20, 16, 30), // Customer submitted on time
				LocalDateTime.of(2026, 11, 20, 17, 0),  // Evaluation time
				PaymentStatus.PAID);

		assertEquals(expected, actual.orderStatus());
	}

	@Test
	void testRejectedAtOriginalDeadlineOpensCorrectionWindowOne() {
		int expectedWindow = 1;
		LocalDateTime expectedDeadline = LocalDateTime.of(2026, 11, 21, 17, 0);

		ScenarioResult actual = testRejectedAtOriginalDeadline(
				DocumentVersionStatus.REJECTED,
				0,                                           // No Correction Window yet
				LocalDateTime.of(2026, 11, 20, 17, 0), // Original Deadline
				LocalDateTime.of(2026, 11, 20, 17, 0)); // Evaluation time

		assertEquals(expectedWindow, actual.correctionWindowNo());
		assertEquals(expectedDeadline, actual.correctionDeadline());
		assertEquals(OrderStatus.APPROVED, actual.orderStatus());
	}

	@Test
	void testMultipleRejectsInWindowOneKeepSameDeadline() {
		int expectedWindow = 1;
		LocalDateTime expectedDeadline = LocalDateTime.of(2026, 11, 21, 17, 0);

		ScenarioResult actual = testRejectsInsideWindow(
				DocumentVersionStatus.REJECTED,
				LocalDateTime.of(2026, 11, 20, 17, 0), // Original Deadline
				1,
				LocalDateTime.of(2026, 11, 21, 17, 0), // Window #1 Deadline
				LocalDateTime.of(2026, 11, 21, 9, 0),  // Customer submit cycle #1
				LocalDateTime.of(2026, 11, 21, 9, 10), // TS reject cycle #1
				LocalDateTime.of(2026, 11, 21, 14, 0), // Customer submit cycle #2
				LocalDateTime.of(2026, 11, 21, 14, 10)); // TS reject cycle #2

		assertEquals(expectedDeadline, actual.correctionDeadline());
		assertEquals(expectedWindow, actual.correctionWindowNo());
	}

	@Test
	void testProtectedSubmissionAfterWindowOneOpensWindowTwo() {
		int expectedWindow = 2;
		LocalDateTime expectedDeadline = LocalDateTime.of(2026, 11, 22, 17, 10);

		ScenarioResult actual = testProtectedSubmission(
				LocalDateTime.of(2026, 11, 20, 17, 0),  // Original Deadline
				1,
				LocalDateTime.of(2026, 11, 21, 17, 0),  // Window #1 Deadline
				LocalDateTime.of(2026, 11, 21, 16, 30), // Customer submits before expiry
				LocalDateTime.of(2026, 11, 21, 17, 10)); // TS rejects after expiry

		assertEquals(expectedWindow, actual.correctionWindowNo());
		assertEquals(expectedDeadline, actual.correctionDeadline());
		assertEquals(OrderStatus.APPROVED, actual.orderStatus());
	}

	@Test
	void testMultipleRejectsInWindowTwoKeepSameDeadline() {
		int expectedWindow = 2;
		LocalDateTime expectedDeadline = LocalDateTime.of(2026, 11, 22, 17, 10);

		ScenarioResult actual = testRejectsInsideWindow(
				DocumentVersionStatus.REJECTED,
				LocalDateTime.of(2026, 11, 20, 17, 0), // Original Deadline
				2,
				LocalDateTime.of(2026, 11, 22, 17, 10), // Window #2 Deadline
				LocalDateTime.of(2026, 11, 22, 9, 0),   // Customer submit cycle #1
				LocalDateTime.of(2026, 11, 22, 9, 10),  // TS reject cycle #1
				LocalDateTime.of(2026, 11, 22, 15, 0),  // Customer submit cycle #2
				LocalDateTime.of(2026, 11, 22, 15, 10)); // TS reject cycle #2

		assertEquals(expectedDeadline, actual.correctionDeadline());
		assertEquals(expectedWindow, actual.correctionWindowNo());
	}

	@Test
	void testMissedCorrectionDeadlineReturnsCancelled() {
		OrderStatus expectedOrder = OrderStatus.CANCELLED;
		PaymentStatus expectedPayment = PaymentStatus.PAID;

		ScenarioResult actual = testMissedCorrectionDeadline(
				DocumentVersionStatus.REJECTED,
				LocalDateTime.of(2026, 11, 20, 17, 0), // Original Deadline
				1,
				LocalDateTime.of(2026, 11, 21, 17, 0), // Window #1 Deadline
				LocalDateTime.of(2026, 11, 21, 17, 0), // Evaluation time
				PaymentStatus.PAID);

		assertEquals(expectedOrder, actual.orderStatus());
		assertEquals(expectedPayment, actual.paymentStatus());
	}

	@Test
	void testSecondCorrectionWindowDoesNotOpenThirdWindow() {
		OrderStatus expectedOrder = OrderStatus.CANCELLED;
		int expectedWindow = 2;

		ScenarioResult actual = testMissedCorrectionDeadline(
				DocumentVersionStatus.REJECTED,
				LocalDateTime.of(2026, 11, 20, 17, 0), // Original Deadline
				2,
				LocalDateTime.of(2026, 11, 22, 17, 0), // Window #2 Deadline
				LocalDateTime.of(2026, 11, 22, 17, 0), // Evaluation time
				PaymentStatus.PAID);

		assertEquals(expectedOrder, actual.orderStatus());
		assertEquals(expectedWindow, actual.correctionWindowNo());
	}

	@Test
	void testFinalProtectedSubmissionRejectedReturnsCancelled() {
		OrderStatus expectedOrder = OrderStatus.CANCELLED;
		int expectedWindow = 2;

		ScenarioResult actual = testFinalProtectedSubmission(
				LocalDateTime.of(2026, 11, 20, 17, 0),  // Original Deadline
				2,
				LocalDateTime.of(2026, 11, 22, 17, 10), // Window #2 Deadline
				LocalDateTime.of(2026, 11, 22, 16, 40), // Customer submits 30 minutes before
				LocalDateTime.of(2026, 11, 22, 17, 20)); // TS rejects 10 minutes after

		assertEquals(expectedOrder, actual.orderStatus());
		assertEquals(expectedWindow, actual.correctionWindowNo());
	}

	@Test
	void testCancellationKeepsDepositPaid() {
		PaymentStatus expectedPayment = PaymentStatus.PAID;

		ScenarioResult actual = testDeadline(
				DocumentVersionStatus.DRAFT,
				LocalDateTime.of(2026, 11, 20, 17, 0), // Original Deadline
				null,                                  // Not submitted
				LocalDateTime.of(2026, 11, 20, 17, 0), // Evaluation time
				PaymentStatus.PAID);                    // Deposit before cancellation

		assertEquals(expectedPayment, actual.paymentStatus());
		assertNull(actual.refundedAt());
	}

	private ScenarioResult testDeadline(DocumentVersionStatus documentStatus,
			LocalDateTime originalDeadline, LocalDateTime submittedAt,
			LocalDateTime evaluationTime, PaymentStatus initialPaymentStatus) {
		BusinessScenario scenario = new BusinessScenario(documentStatus, originalDeadline,
				submittedAt, initialPaymentStatus);
		scenario.evaluateDeadlineAt(evaluationTime);
		return scenario.result();
	}

	private ScenarioResult testRejectedAtOriginalDeadline(DocumentVersionStatus documentStatus,
			int currentWindow, LocalDateTime originalDeadline, LocalDateTime evaluationTime) {
		BusinessScenario scenario = new BusinessScenario(documentStatus, originalDeadline,
				originalDeadline.minusHours(1), PaymentStatus.PAID);
		scenario.setCorrectionState(currentWindow, null);
		scenario.evaluateDeadlineAt(evaluationTime);
		return scenario.result();
	}

	private ScenarioResult testRejectsInsideWindow(DocumentVersionStatus documentStatus,
			LocalDateTime originalDeadline, int windowNo, LocalDateTime windowDeadline,
			LocalDateTime submitOne, LocalDateTime rejectOne,
			LocalDateTime submitTwo, LocalDateTime rejectTwo) {
		BusinessScenario scenario = new BusinessScenario(documentStatus, originalDeadline,
				originalDeadline.minusHours(1), PaymentStatus.PAID);
		scenario.setCorrectionState(windowNo, windowDeadline);
		scenario.resubmitAndRejectAt(submitOne, rejectOne);
		scenario.resubmitAndRejectAt(submitTwo, rejectTwo);
		return scenario.result();
	}

	private ScenarioResult testProtectedSubmission(LocalDateTime originalDeadline,
			int windowNo, LocalDateTime windowDeadline,
			LocalDateTime customerSubmittedAt, LocalDateTime tsRejectedAt) {
		BusinessScenario scenario = new BusinessScenario(DocumentVersionStatus.REJECTED,
				originalDeadline, originalDeadline.minusHours(1), PaymentStatus.PAID);
		scenario.setCorrectionState(windowNo, windowDeadline);
		scenario.resubmitAt(customerSubmittedAt);
		scenario.evaluateDeadlineAt(windowDeadline);
		scenario.rejectCurrentAt(tsRejectedAt);
		return scenario.result();
	}

	private ScenarioResult testMissedCorrectionDeadline(DocumentVersionStatus documentStatus,
			LocalDateTime originalDeadline, int windowNo, LocalDateTime correctionDeadline,
			LocalDateTime evaluationTime, PaymentStatus initialPaymentStatus) {
		BusinessScenario scenario = new BusinessScenario(documentStatus, originalDeadline,
				originalDeadline.minusHours(1), initialPaymentStatus);
		scenario.setCorrectionState(windowNo, correctionDeadline);
		scenario.evaluateDeadlineAt(evaluationTime);
		return scenario.result();
	}

	private ScenarioResult testFinalProtectedSubmission(LocalDateTime originalDeadline,
			int windowNo, LocalDateTime windowDeadline,
			LocalDateTime customerSubmittedAt, LocalDateTime tsRejectedAt) {
		BusinessScenario scenario = new BusinessScenario(DocumentVersionStatus.REJECTED,
				originalDeadline, originalDeadline.minusHours(1), PaymentStatus.PAID);
		scenario.setCorrectionState(windowNo, windowDeadline);
		scenario.resubmitAt(customerSubmittedAt);
		scenario.evaluateDeadlineAt(windowDeadline);
		scenario.rejectCurrentAt(tsRejectedAt);
		return scenario.result();
	}

	private record ScenarioResult(OrderStatus orderStatus, PaymentStatus paymentStatus,
			LocalDateTime refundedAt, int correctionWindowNo, LocalDateTime correctionDeadline) {
	}

	private static final class BusinessScenario {
		private final LocalDateTime originalDeadline;
		private final TransportOrder order;
		private final TransportOrderHorse orderHorse;
		private final Payment deposit;
		private final HorseDocument primaryDocument;
		private final List<HorseDocument> documents = new ArrayList<>();
		private final Map<UUID, HorseDocumentVersion> currentVersions = new LinkedHashMap<>();

		private final TransportOrderRepository orderRepository = mock(TransportOrderRepository.class);
		private final HorseDocumentRepository documentRepository = mock(HorseDocumentRepository.class);
		private final HorseDocumentVersionRepository versionRepository = mock(HorseDocumentVersionRepository.class);
		private final PaymentRepository paymentRepository = mock(PaymentRepository.class);
		private final StatusAuditLogRepository auditRepository = mock(StatusAuditLogRepository.class);
		private final NotificationService notificationService = mock(NotificationService.class);
		private final TransportSpecialistAssignmentGuard assignmentGuard =
				mock(TransportSpecialistAssignmentGuard.class);
		private final CurrentUserProvider currentUserProvider = mock(CurrentUserProvider.class);
		private final DocumentDeadlineOrderProcessor deadlineProcessor;

		private int nextVersionNo = 2;

		BusinessScenario(DocumentVersionStatus primaryStatus, LocalDateTime originalDeadline,
				LocalDateTime primarySubmittedAt, PaymentStatus initialPaymentStatus) {
			this.originalDeadline = originalDeadline;
			order = newEntity(TransportOrder.class);
			ReflectionTestUtils.setField(order, "id", ORDER_ID);
			ReflectionTestUtils.setField(order, "orderCode", "ORD-DEADLINE-DEMO");
			ReflectionTestUtils.setField(order, "customerId", CUSTOMER_ID);
			ReflectionTestUtils.setField(order, "status", OrderStatus.APPROVED);
			ReflectionTestUtils.setField(order, "documentCompletionDeadlineAt", originalDeadline);

			orderHorse = newEntity(TransportOrderHorse.class);
			ReflectionTestUtils.setField(orderHorse, "id", HORSE_ID);
			ReflectionTestUtils.setField(orderHorse, "transportOrder", order);
			ReflectionTestUtils.setField(orderHorse, "horseId", HORSE_ID);
			ReflectionTestUtils.setField(orderHorse, "documentStatus", OrderHorseDocumentStatus.UNDER_REVIEW);
			ReflectionTestUtils.setField(order, "horses", new ArrayList<>(List.of(orderHorse)));

			deposit = newEntity(Payment.class);
			ReflectionTestUtils.setField(deposit, "id", UUID.randomUUID());
			ReflectionTestUtils.setField(deposit, "transportOrderId", ORDER_ID);
			ReflectionTestUtils.setField(deposit, "paymentType", PaymentType.DEPOSIT);
			ReflectionTestUtils.setField(deposit, "amount", new BigDecimal("50.00"));
			ReflectionTestUtils.setField(deposit, "currency", "USD");
			ReflectionTestUtils.setField(deposit, "status", initialPaymentStatus);

			for (DocumentType type : DocumentType.values()) {
				HorseDocument document = new HorseDocument(orderHorse, type);
				documents.add(document);
				DocumentVersionStatus status = documents.size() == 1
						? primaryStatus : DocumentVersionStatus.APPROVED;
				LocalDateTime submittedAt = documents.size() == 1
						? primarySubmittedAt : originalDeadline.minusDays(1);
				currentVersions.put(document.getId(), versionWithStatus(document, 1, status, submittedAt));
			}
			primaryDocument = documents.getFirst();

			configureRepositories();
			deadlineProcessor = new DocumentDeadlineOrderProcessor(orderRepository, documentRepository,
					versionRepository, paymentRepository, auditRepository, notificationService);
		}

		void setCorrectionState(int windowNo, LocalDateTime deadline) {
			ReflectionTestUtils.setField(primaryDocument, "correctionWindowNo", windowNo);
			ReflectionTestUtils.setField(primaryDocument, "correctionDeadlineAt", deadline);
		}

		void evaluateDeadlineAt(LocalDateTime time) {
			deadlineProcessor.cancelForIncompleteDeadline(ORDER_ID, time);
		}

		void resubmitAndRejectAt(LocalDateTime submittedAt, LocalDateTime rejectedAt) {
			resubmitAt(submittedAt);
			rejectCurrentAt(rejectedAt);
		}

		void resubmitAt(LocalDateTime submittedAt) {
			HorseDocumentVersion previous = currentVersions.get(primaryDocument.getId());
			previous.makeHistorical();
			HorseDocumentVersion replacement = new HorseDocumentVersion(primaryDocument, nextVersionNo++,
					"https://example.test/corrected-document.pdf", null, CUSTOMER_ID,
					submittedAt.minusMinutes(1));
			replacement.submit(submittedAt);
			currentVersions.put(primaryDocument.getId(), replacement);
			when(versionRepository.findById(replacement.getId())).thenReturn(Optional.of(replacement));
		}

		void rejectCurrentAt(LocalDateTime rejectedAt) {
			HorseDocumentVersion current = currentVersions.get(primaryDocument.getId());
			DocumentReviewService reviewService = new DocumentReviewService(documentRepository,
					versionRepository, orderRepository, auditRepository, assignmentGuard,
					deadlineProcessor, currentUserProvider, fixedClock(rejectedAt));
			reviewService.reject(primaryDocument.getId(), current.getId(),
					new RejectDocumentVersionRequest("Document correction is still required"));
		}

		ScenarioResult result() {
			return new ScenarioResult(order.getStatus(), deposit.getStatus(), deposit.getRefundedAt(),
					primaryDocument.getCorrectionWindowNo(), primaryDocument.getCorrectionDeadlineAt());
		}

		private void configureRepositories() {
			when(orderRepository.findByIdForUpdate(ORDER_ID)).thenReturn(Optional.of(order));
			when(documentRepository.findAllByOrderHorseIds(anyCollection())).thenReturn(documents);
			when(documentRepository.findById(primaryDocument.getId())).thenReturn(Optional.of(primaryDocument));
			when(documentRepository.findByIdForUpdate(primaryDocument.getId()))
					.thenReturn(Optional.of(primaryDocument));
			when(versionRepository.findCurrentByHorseDocumentIds(anyCollection()))
					.thenAnswer(ignored -> List.copyOf(currentVersions.values()));
			when(versionRepository.findCurrentByOrderHorseId(HORSE_ID))
					.thenAnswer(ignored -> List.copyOf(currentVersions.values()));
			currentVersions.values().forEach(version ->
					when(versionRepository.findById(version.getId())).thenReturn(Optional.of(version)));
			when(versionRepository.saveAndFlush(any(HorseDocumentVersion.class)))
					.thenAnswer(invocation -> invocation.getArgument(0));
			when(auditRepository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
			when(paymentRepository.findByTransportOrderIdAndPaymentType(ORDER_ID, PaymentType.DEPOSIT))
					.thenReturn(Optional.of(deposit));
			when(currentUserProvider.getCurrentUserId()).thenReturn(TS_ID);
		}

		private HorseDocumentVersion versionWithStatus(HorseDocument document, int versionNo,
				DocumentVersionStatus status, LocalDateTime submittedAt) {
			LocalDateTime uploadedAt = submittedAt != null
					? submittedAt.minusMinutes(30) : originalDeadline.minusDays(1);
			HorseDocumentVersion version = new HorseDocumentVersion(document, versionNo,
					"https://example.test/document.pdf", null, CUSTOMER_ID, uploadedAt);
			if (status == DocumentVersionStatus.DRAFT) return version;

			version.submit(submittedAt);
			if (status == DocumentVersionStatus.APPROVED) {
				version.approve(TS_ID, submittedAt.plusMinutes(10));
			}
			else if (status == DocumentVersionStatus.REJECTED) {
				version.reject(TS_ID, "Correction required", submittedAt.plusMinutes(10));
			}
			return version;
		}
	}

	private static Clock fixedClock(LocalDateTime time) {
		Instant instant = time.toInstant(ZoneOffset.UTC);
		return Clock.fixed(instant, ZoneOffset.UTC);
	}

	private static <T> T newEntity(Class<T> entityType) {
		try {
			Constructor<T> constructor = entityType.getDeclaredConstructor();
			constructor.setAccessible(true);
			return constructor.newInstance();
		}
		catch (ReflectiveOperationException exception) {
			throw new AssertionError("Could not create test entity " + entityType.getSimpleName(), exception);
		}
	}
}
