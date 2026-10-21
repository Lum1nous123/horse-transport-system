package com.horsetransport.order;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;

import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class TransportSpecialistAssignmentGuardTest {
	private static final UUID ORDER_ID = UUID.randomUUID();
	private static final UUID TS_ID = UUID.randomUUID();

	private final OrderStaffAssignmentRepository assignmentRepository = mock(OrderStaffAssignmentRepository.class);
	private final CurrentUserProvider currentUserProvider = mock(CurrentUserProvider.class);
	private final TransportSpecialistAssignmentGuard guard = new TransportSpecialistAssignmentGuard(
			assignmentRepository, currentUserProvider);

	@BeforeEach
	void setUp() {
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.TRANSPORT_SPECIALIST);
		when(currentUserProvider.getCurrentUserId()).thenReturn(TS_ID);
	}

	@Test
	void allowsTheTransportSpecialistAssignedToTheOrder() {
		when(assignmentRepository.existsByTransportOrderIdAndAssignmentRoleAndUserId(ORDER_ID,
				OrderStaffRole.TRANSPORT_SPECIALIST, TS_ID)).thenReturn(true);

		guard.requireAssignedToCurrentTransportSpecialist(ORDER_ID);

		verify(assignmentRepository).existsByTransportOrderIdAndAssignmentRoleAndUserId(ORDER_ID,
				OrderStaffRole.TRANSPORT_SPECIALIST, TS_ID);
	}

	@Test
	void rejectsUnassignedTransportSpecialist() {
		assertThatThrownBy(() -> guard.requireAssignedToCurrentTransportSpecialist(ORDER_ID))
				.isInstanceOf(UnassignedTransportSpecialistException.class);
	}

	@Test
	void rejectsOtherRolesEvenIfAnAssignmentMatchesTheirIdentity() {
		when(currentUserProvider.getCurrentUserRole()).thenReturn(UserRole.CUSTOMER);

		assertThatThrownBy(() -> guard.requireAssignedToCurrentTransportSpecialist(ORDER_ID))
				.isInstanceOf(UnassignedTransportSpecialistException.class);
	}
}
