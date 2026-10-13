package com.horsetransport.document;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Constructor;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.horsetransport.order.OrderNotFoundException;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderHorse;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.order.TransportSpecialistAssignmentGuard;
import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class DocumentChecklistServiceTest {

	private static final UUID ORDER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
	private static final UUID CUSTOMER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final UUID TS_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");

	@Mock private TransportOrderRepository orderRepository;
	@Mock private HorseDocumentRepository documentRepository;
	@Mock private HorseDocumentVersionRepository versionRepository;
	@Mock private TransportSpecialistAssignmentGuard assignmentGuard;
	@Mock private CurrentUserProvider currentUserProvider;
	private DocumentChecklistService service;
	private final List<HorseDocument> checklistDocuments = new ArrayList<>();

	@BeforeEach
	void setUp() {
		service = new DocumentChecklistService(orderRepository, documentRepository, versionRepository,
				assignmentGuard, currentUserProvider);
	}

	@Test
	void generatesFiveMandatoryRowsForOneHorseAndFifteenForThreeHorses() {
		assertGeneratedCount(1, 5);
		org.mockito.Mockito.reset(orderRepository, documentRepository);
		assertGeneratedCount(3, 15);
	}

	@Test
	void repeatedHookIsIdempotentAndPartialChecklistIsCompleted() {
		TransportOrder order = order(OrderStatus.APPROVED, 1);
		TransportOrderHorse horse = order.getHorses().getFirst();
		List<HorseDocument> stored = new ArrayList<>();
		stored.add(new HorseDocument(horse, DocumentType.VACCINATION_CERTIFICATE));
		stubGenerator(order, stored);

		service.startForOrder(ORDER_ID);
		service.startForOrder(ORDER_ID);

		assertThat(stored).hasSize(5);
		assertThat(stored).extracting(HorseDocument::getDocumentType)
				.containsExactlyInAnyOrderElementsOf(List.of(DocumentType.values()));
	}

	@Test
	void generationRequiresApprovedOrder() {
		TransportOrder order = order(OrderStatus.QUOTATION_SENT, 1);
		when(orderRepository.findByIdForUpdate(ORDER_ID)).thenReturn(Optional.of(order));

		assertThatThrownBy(() -> service.startForOrder(ORDER_ID))
				.isInstanceOf(DocumentChecklistConflictException.class)
				.hasMessageContaining("APPROVED");
		verify(documentRepository, never()).saveAllAndFlush(any());
	}

	@Test
	void checklistPersistenceFailurePropagatesToOwningPaymentTransaction() {
		TransportOrder order = order(OrderStatus.APPROVED, 1);
		when(orderRepository.findByIdForUpdate(ORDER_ID)).thenReturn(Optional.of(order));
		when(documentRepository.findAllByOrderHorseIds(any())).thenReturn(List.of());
		when(documentRepository.saveAllAndFlush(any()))
				.thenThrow(new DataIntegrityViolationException("checklist failure"));

		assertThatThrownBy(() -> service.startForOrder(ORDER_ID))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void transportSpecialistSetsDeadlineOnceAndSameMicrosecondValueIsIdempotent() {
		TransportOrder order = completeApprovedOrder(1);
		LocalDateTime input = LocalDateTime.of(2026, 10, 15, 17, 0, 0, 123_456_789);
		when(currentUserProvider.getCurrentUserId()).thenReturn(TS_ID);
		when(orderRepository.findByIdForUpdate(ORDER_ID)).thenReturn(Optional.of(order));

		DocumentDeadlineResponse first = service.setDeadline(ORDER_ID, new SetDocumentDeadlineRequest(input));
		DocumentDeadlineResponse retry = service.setDeadline(ORDER_ID,
				new SetDocumentDeadlineRequest(input.plusNanos(111)));

		assertThat(first.documentCompletionDeadlineAt()).isEqualTo(input.truncatedTo(java.time.temporal.ChronoUnit.MICROS));
		assertThat(retry.documentCompletionDeadlineAt()).isEqualTo(first.documentCompletionDeadlineAt());
		assertThat(order.getDocumentDeadlineSetBy()).isEqualTo(TS_ID);
		assertThat(order.getDocumentDeadlineSetAt()).isNotNull();
		verify(orderRepository).saveAndFlush(order);
	}

	@Test
	void changingExistingDeadlineIsConflict() {
		TransportOrder order = completeApprovedOrder(1);
		LocalDateTime deadline = LocalDateTime.of(2026, 10, 15, 17, 0);
		order.setDocumentCompletionDeadline(deadline, TS_ID);
		when(orderRepository.findByIdForUpdate(ORDER_ID)).thenReturn(Optional.of(order));

		assertThatThrownBy(() -> service.setDeadline(ORDER_ID,
				new SetDocumentDeadlineRequest(deadline.plusDays(1))))
				.isInstanceOf(DocumentChecklistConflictException.class)
				.hasMessageContaining("already been set");
		verify(orderRepository, never()).saveAndFlush(any());
	}

	@Test
	void deadlineRequiresApprovedOrderAndCompleteChecklist() {
		TransportOrder submitted = order(OrderStatus.SUBMITTED, 1);
		when(orderRepository.findByIdForUpdate(ORDER_ID)).thenReturn(Optional.of(submitted));
		assertThatThrownBy(() -> service.setDeadline(ORDER_ID,
				new SetDocumentDeadlineRequest(LocalDateTime.now())))
				.isInstanceOf(DocumentChecklistConflictException.class).hasMessageContaining("APPROVED");

		TransportOrder approved = order(OrderStatus.APPROVED, 1);
		when(orderRepository.findByIdForUpdate(ORDER_ID)).thenReturn(Optional.of(approved));
		when(documentRepository.findAllByOrderHorseIds(any())).thenReturn(List.of());
		assertThatThrownBy(() -> service.setDeadline(ORDER_ID,
				new SetDocumentDeadlineRequest(LocalDateTime.now())))
				.isInstanceOf(DocumentChecklistConflictException.class).hasMessageContaining("incomplete");
	}

	@Test
	void customerReadsOnlyOwnedCompleteChecklistAndRequiredIsDerivedTrue() {
		TransportOrder order = completeApprovedOrder(1);
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.CUSTOMER);
		when(currentUserProvider.getCurrentUserId()).thenReturn(CUSTOMER_ID);
		when(orderRepository.findByIdAndCustomerId(ORDER_ID, CUSTOMER_ID)).thenReturn(Optional.of(order));

		DocumentChecklistResponse response = service.getChecklist(ORDER_ID);

		assertThat(response.horses()).hasSize(1);
		assertThat(response.horses().getFirst().documents()).hasSize(5)
				.allMatch(HorseDocumentItemResponse::required);
		verify(orderRepository, never()).findById(ORDER_ID);
	}

	@Test
	void nonOwnerCustomerGetsNotFoundAndMissingChecklistGetsNotFound() {
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.CUSTOMER);
		when(currentUserProvider.getCurrentUserId()).thenReturn(CUSTOMER_ID);
		when(orderRepository.findByIdAndCustomerId(ORDER_ID, CUSTOMER_ID)).thenReturn(Optional.empty());
		assertThatThrownBy(() -> service.getChecklist(ORDER_ID)).isInstanceOf(OrderNotFoundException.class);

		TransportOrder order = order(OrderStatus.APPROVED, 1);
		when(orderRepository.findByIdAndCustomerId(ORDER_ID, CUSTOMER_ID)).thenReturn(Optional.of(order));
		when(documentRepository.findAllByOrderHorseIds(any())).thenReturn(List.of());
		assertThatThrownBy(() -> service.getChecklist(ORDER_ID))
				.isInstanceOf(DocumentChecklistNotFoundException.class);
	}

	@Test
	void transportSpecialistCanReadAnyCompleteChecklist() {
		TransportOrder order = completeApprovedOrder(1);
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.TRANSPORT_SPECIALIST);
		when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));

		assertThat(service.getChecklist(ORDER_ID).orderId()).isEqualTo(ORDER_ID);
		verify(assignmentGuard).requireAssignedToCurrentTransportSpecialist(ORDER_ID);
	}

	@Test
	void unassignedTransportSpecialistCannotReadDocumentPhaseDetail() {
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.TRANSPORT_SPECIALIST);
		doThrow(new com.horsetransport.order.UnassignedTransportSpecialistException())
				.when(assignmentGuard).requireAssignedToCurrentTransportSpecialist(ORDER_ID);

		assertThatThrownBy(() -> service.getChecklist(ORDER_ID))
				.isInstanceOf(com.horsetransport.order.UnassignedTransportSpecialistException.class);
		verify(orderRepository, never()).findById(ORDER_ID);
	}

	@Test
	void finalConfirmPersistsActorAndPermanentLockOnlyWhenAllCurrentDocumentsAreApproved() {
		TransportOrder order = completeApprovedOrder(1);
		List<HorseDocumentVersion> versions = approvedVersions(checklistDocuments);
		when(currentUserProvider.getCurrentUserId()).thenReturn(TS_ID);
		when(orderRepository.findByIdForUpdate(ORDER_ID)).thenReturn(Optional.of(order));
		when(versionRepository.findCurrentByHorseDocumentIds(any())).thenReturn(versions);

		DocumentChecklistResponse response = service.finalConfirm(ORDER_ID);

		assertThat(response.documentsFinalConfirmedBy()).isEqualTo(TS_ID);
		assertThat(response.documentsFinalConfirmedAt()).isNotNull();
		assertThat(response.documentsLockedAt()).isEqualTo(response.documentsFinalConfirmedAt());
		assertThat(response.canFinalConfirm()).isFalse();
		assertThat(order.getDocumentsFinalConfirmedBy()).isEqualTo(TS_ID);
		verify(orderRepository).saveAndFlush(order);

		assertThatThrownBy(() -> service.finalConfirm(ORDER_ID))
				.isInstanceOf(DocumentChecklistConflictException.class).hasMessageContaining("already");
	}

	@Test
	void finalConfirmRejectsUnapprovedOrMissingCurrentVersionsWithoutLocking() {
		TransportOrder order = completeApprovedOrder(1);
		when(orderRepository.findByIdForUpdate(ORDER_ID)).thenReturn(Optional.of(order));
		when(versionRepository.findCurrentByHorseDocumentIds(any())).thenReturn(List.of());

		assertThatThrownBy(() -> service.finalConfirm(ORDER_ID))
				.isInstanceOf(DocumentChecklistConflictException.class).hasMessageContaining("APPROVED");
		assertThat(order.getDocumentsLockedAt()).isNull();
		verify(orderRepository, never()).saveAndFlush(any());
	}

	private void assertGeneratedCount(int horseCount, int expectedDocuments) {
		TransportOrder order = order(OrderStatus.APPROVED, horseCount);
		List<HorseDocument> stored = new ArrayList<>();
		stubGenerator(order, stored);

		service.startForOrder(ORDER_ID);

		assertThat(stored).hasSize(expectedDocuments);
		for (TransportOrderHorse horse : order.getHorses()) {
			assertThat(stored.stream().filter(document -> document.getTransportOrderHorseId().equals(horse.getId())))
					.extracting(HorseDocument::getDocumentType)
					.containsExactlyInAnyOrderElementsOf(List.of(DocumentType.values()));
		}
	}

	private TransportOrder completeApprovedOrder(int horseCount) {
		TransportOrder order = order(OrderStatus.APPROVED, horseCount);
		checklistDocuments.clear();
		for (TransportOrderHorse horse : order.getHorses()) {
			for (DocumentType type : DocumentType.values()) checklistDocuments.add(new HorseDocument(horse, type));
		}
		when(documentRepository.findAllByOrderHorseIds(any())).thenReturn(checklistDocuments);
		return order;
	}

	private List<HorseDocumentVersion> approvedVersions(List<HorseDocument> documents) {
		return documents.stream().map(document -> {
			HorseDocumentVersion version = new HorseDocumentVersion(document, 1,
					"https://example.test/document.pdf", null, CUSTOMER_ID);
			version.submit();
			version.approve(TS_ID);
			return version;
		}).toList();
	}

	@SuppressWarnings("unchecked")
	private void stubGenerator(TransportOrder order, List<HorseDocument> stored) {
		when(orderRepository.findByIdForUpdate(ORDER_ID)).thenReturn(Optional.of(order));
		when(documentRepository.findAllByOrderHorseIds(any())).thenAnswer(invocation -> List.copyOf(stored));
		when(documentRepository.saveAllAndFlush(any())).thenAnswer(invocation -> {
			stored.addAll((Collection<HorseDocument>) invocation.getArgument(0));
			return invocation.getArgument(0);
		});
	}

	private TransportOrder order(OrderStatus status, int horseCount) {
		try {
			Constructor<TransportOrder> orderConstructor = TransportOrder.class
					.getDeclaredConstructor(UUID.class, String.class);
			orderConstructor.setAccessible(true);
			TransportOrder order = orderConstructor.newInstance(CUSTOMER_ID, "ORD-documents");
			ReflectionTestUtils.setField(order, "id", ORDER_ID);
			ReflectionTestUtils.setField(order, "status", status);
			Constructor<TransportOrderHorse> horseConstructor = TransportOrderHorse.class
					.getDeclaredConstructor(TransportOrder.class, UUID.class);
			horseConstructor.setAccessible(true);
			List<TransportOrderHorse> horses = new ArrayList<>();
			for (int index = 0; index < horseCount; index++) {
				horses.add(horseConstructor.newInstance(order, UUID.randomUUID()));
			}
			ReflectionTestUtils.setField(order, "horses", horses);
			return order;
		}
		catch (ReflectiveOperationException exception) {
			throw new IllegalStateException(exception);
		}
	}
}
