package com.horsetransport.order;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.StreamSupport;

import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import com.horsetransport.user.UserStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OrderStaffAssignmentServiceTest {
	private static final UUID ORDER_ID = UUID.randomUUID();
	private static final UUID LM_ID = UUID.randomUUID();
	private static final UUID TS_ID = UUID.randomUUID();
	private static final UUID FRC_ID = UUID.randomUUID();

	private final OrderStaffAssignmentRepository assignmentRepository = mock(OrderStaffAssignmentRepository.class);
	private final TransportOrderRepository orderRepository = mock(TransportOrderRepository.class);
	private final UserRepository userRepository = mock(UserRepository.class);
	private final CurrentUserProvider currentUserProvider = mock(CurrentUserProvider.class);
	private final OrderStaffAssignmentService service = new OrderStaffAssignmentService(
			assignmentRepository, orderRepository, userRepository, currentUserProvider);
	private TransportOrder order;

	@BeforeEach
	void setUp() {
		order = mock(TransportOrder.class);
		when(order.getStatus()).thenReturn(OrderStatus.APPROVED);
		when(orderRepository.findByIdForUpdate(ORDER_ID)).thenReturn(Optional.of(order));
		when(assignmentRepository.existsByTransportOrderId(ORDER_ID)).thenReturn(false);
		UserAccount ts = activeUser(TS_ID, "TS User", UserRole.TRANSPORT_SPECIALIST);
		UserAccount frc = activeUser(FRC_ID, "FRC User", UserRole.FLEET_ROUTE_COORDINATOR);
		when(userRepository.findByIdForUpdate(TS_ID)).thenReturn(Optional.of(ts));
		when(userRepository.findByIdForUpdate(FRC_ID)).thenReturn(Optional.of(frc));
		when(currentUserProvider.getCurrentUserId()).thenReturn(LM_ID);
		when(userRepository.findAllById(anyList())).thenReturn(List.of(ts, frc));
	}

	@Test
	void assignsBothRequiredRolesInOneMutationAndReadsBackPersistedRows() {
		when(assignmentRepository.findAllByTransportOrderIdOrderByAssignmentRole(ORDER_ID)).thenReturn(List.of(
				OrderStaffAssignment.assign(ORDER_ID, OrderStaffRole.FLEET_ROUTE_COORDINATOR, FRC_ID, LM_ID),
				OrderStaffAssignment.assign(ORDER_ID, OrderStaffRole.TRANSPORT_SPECIALIST, TS_ID, LM_ID)));

		List<OrderStaffAssignmentResponse> result = service.assign(ORDER_ID,
				new AssignOrderStaffRequest(TS_ID, FRC_ID));

		assertEquals(2, result.size());
		assertEquals(LM_ID, result.get(0).assignedBy());
		verify(assignmentRepository).saveAllAndFlush(org.mockito.ArgumentMatchers.argThat(rows -> {
			List<OrderStaffAssignment> saved = StreamSupport.stream(rows.spliterator(), false).toList();
			return saved.size() == 2
				&& saved.stream().anyMatch(row -> row.getAssignmentRole() == OrderStaffRole.TRANSPORT_SPECIALIST
						&& row.getUserId().equals(TS_ID))
				&& saved.stream().anyMatch(row -> row.getAssignmentRole() == OrderStaffRole.FLEET_ROUTE_COORDINATOR
						&& row.getUserId().equals(FRC_ID));
		}));
	}

	@Test
	void rejectsPartialSelectionBeforeWriting() {
		assertThrows(InvalidOrderStaffAssignmentException.class,
				() -> service.assign(ORDER_ID, new AssignOrderStaffRequest(TS_ID, null)));
		verify(assignmentRepository, never()).saveAllAndFlush(anyList());
	}

	@Test
	void rejectsInactiveOrWrongRoleCandidateBeforeWriting() {
		UserAccount inactive = inactiveUser(UserRole.TRANSPORT_SPECIALIST);
		when(userRepository.findByIdForUpdate(TS_ID)).thenReturn(Optional.of(inactive));
		assertThrows(InvalidOrderStaffAssignmentException.class,
				() -> service.assign(ORDER_ID, new AssignOrderStaffRequest(TS_ID, FRC_ID)));
		verify(assignmentRepository, never()).saveAllAndFlush(anyList());
	}

	@Test
	void rejectsActiveUserWithWrongRoleBeforeWriting() {
		UserAccount wrongRole = activeUser(TS_ID, "Wrong Role", UserRole.FLEET_ROUTE_COORDINATOR);
		when(userRepository.findByIdForUpdate(TS_ID)).thenReturn(Optional.of(wrongRole));
		assertThrows(InvalidOrderStaffAssignmentException.class,
				() -> service.assign(ORDER_ID, new AssignOrderStaffRequest(TS_ID, FRC_ID)));
		verify(assignmentRepository, never()).saveAllAndFlush(anyList());
	}

	@Test
	void candidateLookupRequiresAnUnassignedApprovedOrderAndRequestsTheSelectedRole() {
		when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));
		when(userRepository.findActiveStaffCandidates(UserRole.TRANSPORT_SPECIALIST,
				List.of(OrderStatus.APPROVED, OrderStatus.READY_TO_SHIP, OrderStatus.IN_PROGRESS)))
				.thenReturn(List.of(new StaffCandidateResponse(TS_ID, "TS User",
						UserRole.TRANSPORT_SPECIALIST, 2)));

		List<StaffCandidateResponse> candidates = service.findCandidates(ORDER_ID,
				OrderStaffRole.TRANSPORT_SPECIALIST);

		assertEquals(2, candidates.get(0).activeOrderCount());
		verify(userRepository).findActiveStaffCandidates(UserRole.TRANSPORT_SPECIALIST,
				List.of(OrderStatus.APPROVED, OrderStatus.READY_TO_SHIP, OrderStatus.IN_PROGRESS));
	}

	@Test
	void rejectsStaleOrderThatHasAlreadyBeenAssigned() {
		when(assignmentRepository.existsByTransportOrderId(ORDER_ID)).thenReturn(true);
		assertThrows(OrderStaffAssignmentConflictException.class,
				() -> service.assign(ORDER_ID, new AssignOrderStaffRequest(TS_ID, FRC_ID)));
		verify(assignmentRepository, never()).saveAllAndFlush(anyList());
	}

	@Test
	void rejectsOrderThatIsNoLongerApproved() {
		when(order.getStatus()).thenReturn(OrderStatus.READY_TO_SHIP);
		assertThrows(OrderStaffAssignmentConflictException.class,
				() -> service.assign(ORDER_ID, new AssignOrderStaffRequest(TS_ID, FRC_ID)));
		verify(assignmentRepository, never()).saveAllAndFlush(anyList());
	}

	private UserAccount activeUser(UUID id, String fullName, UserRole role) {
		UserAccount user = mock(UserAccount.class);
		when(user.getId()).thenReturn(id);
		when(user.getFullName()).thenReturn(fullName);
		when(user.getRole()).thenReturn(role);
		when(user.getStatus()).thenReturn(UserStatus.ACTIVE);
		return user;
	}

	private UserAccount inactiveUser(UserRole role) {
		UserAccount user = mock(UserAccount.class);
		when(user.getId()).thenReturn(TS_ID);
		when(user.getRole()).thenReturn(role);
		when(user.getStatus()).thenReturn(UserStatus.INACTIVE);
		return user;
	}
}
