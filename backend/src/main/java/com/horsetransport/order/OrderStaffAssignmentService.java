package com.horsetransport.order;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import com.horsetransport.user.UserStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderStaffAssignmentService {
	private static final List<OrderStatus> TERMINAL_ORDER_STATUSES = List.of(
			OrderStatus.DELIVERED, OrderStatus.REJECTED, OrderStatus.CANCELLED);

	private final OrderStaffAssignmentRepository assignmentRepository;
	private final TransportOrderRepository orderRepository;
	private final UserRepository userRepository;
	private final CurrentUserProvider currentUserProvider;

	public OrderStaffAssignmentService(OrderStaffAssignmentRepository assignmentRepository,
			TransportOrderRepository orderRepository, UserRepository userRepository,
			CurrentUserProvider currentUserProvider) {
		this.assignmentRepository = assignmentRepository;
		this.orderRepository = orderRepository;
		this.userRepository = userRepository;
		this.currentUserProvider = currentUserProvider;
	}

	@Transactional(readOnly = true)
	public List<OrderAssignmentInboxResponse> findInbox(OrderAssignmentState state) {
		if (state == null) {
			throw new InvalidOrderStaffAssignmentException("An assignment state is required");
		}
		List<TransportOrder> orders = switch (state) {
			case NEEDS_ASSIGNMENT -> assignmentRepository.findUnassignedOrdersByStatus(OrderStatus.APPROVED);
			case ASSIGNED -> assignmentRepository.findAssignedNonTerminalOrders(TERMINAL_ORDER_STATUSES);
		};
		return orders.stream()
				.map(OrderAssignmentInboxResponse::from).toList();
	}

	@Transactional(readOnly = true)
	public List<StaffCandidateResponse> findCandidates(UUID orderId, OrderStaffRole role) {
		ensureAssignableOrder(orderId);
		if (role == null) {
			throw new InvalidOrderStaffAssignmentException("A staff role is required");
		}
		return findCandidates(role);
	}

	@Transactional(readOnly = true)
	public List<OrderStaffAssignmentResponse> findAssignments(UUID orderId) {
		orderRepository.findById(orderId).orElseThrow(OrderNotFoundException::new);
		return toResponses(assignmentRepository.findAllByTransportOrderIdOrderByAssignmentRole(orderId));
	}

	@Transactional
	public List<OrderStaffAssignmentResponse> assign(UUID orderId, AssignOrderStaffRequest request) {
		if (request == null || request.transportSpecialistId() == null
				|| request.fleetRouteCoordinatorId() == null) {
			throw new InvalidOrderStaffAssignmentException("Both staff selections are required");
		}

		TransportOrder order = orderRepository.findByIdForUpdate(orderId)
				.orElseThrow(OrderNotFoundException::new);
		if (order.getStatus() != OrderStatus.APPROVED) {
			throw new OrderStaffAssignmentConflictException("Only APPROVED orders can be assigned");
		}
		if (assignmentRepository.existsByTransportOrderId(orderId)) {
			throw new OrderStaffAssignmentConflictException("Order staff has already been assigned");
		}

		UUID tsId = request.transportSpecialistId();
		UUID frcId = request.fleetRouteCoordinatorId();
		List<UUID> lockOrder = List.of(tsId, frcId).stream().distinct().sorted(Comparator.naturalOrder()).toList();
		Map<UUID, UserAccount> selectedUsers = lockOrder.stream()
				.map(id -> userRepository.findByIdForUpdate(id).orElse(null))
				.filter(java.util.Objects::nonNull)
				.collect(Collectors.toMap(UserAccount::getId, Function.identity()));

		validateSelectedUser(selectedUsers.get(tsId), UserRole.TRANSPORT_SPECIALIST);
		validateSelectedUser(selectedUsers.get(frcId), UserRole.FLEET_ROUTE_COORDINATOR);

		UUID assignedBy = currentUserProvider.getCurrentUserId();
		assignmentRepository.saveAllAndFlush(List.of(
				OrderStaffAssignment.assign(orderId, OrderStaffRole.TRANSPORT_SPECIALIST, tsId, assignedBy),
				OrderStaffAssignment.assign(orderId, OrderStaffRole.FLEET_ROUTE_COORDINATOR, frcId, assignedBy)));
		return toResponses(assignmentRepository.findAllByTransportOrderIdOrderByAssignmentRole(orderId));
	}

	private void ensureAssignableOrder(UUID orderId) {
		TransportOrder order = orderRepository.findById(orderId).orElseThrow(OrderNotFoundException::new);
		if (order.getStatus() != OrderStatus.APPROVED || assignmentRepository.existsByTransportOrderId(orderId)) {
			throw new OrderStaffAssignmentConflictException("Order is not available for staff assignment");
		}
	}

	private void validateSelectedUser(UserAccount user, UserRole expectedRole) {
		if (user == null || user.getStatus() != UserStatus.ACTIVE || user.getRole() != expectedRole) {
			throw new InvalidOrderStaffAssignmentException("Selected staff must be an ACTIVE user with the required role");
		}
	}

	private List<StaffCandidateResponse> findCandidates(OrderStaffRole role) {
		return switch (role) {
			case TRANSPORT_SPECIALIST -> userRepository.findActiveTransportSpecialistCandidates();
			case FLEET_ROUTE_COORDINATOR -> userRepository.findActiveFleetRouteCoordinatorCandidates();
		};
	}

	private List<OrderStaffAssignmentResponse> toResponses(List<OrderStaffAssignment> assignments) {
		Map<UUID, UserAccount> users = userRepository.findAllById(assignments.stream()
				.map(OrderStaffAssignment::getUserId).distinct().toList()).stream()
				.collect(Collectors.toMap(UserAccount::getId, Function.identity()));
		Map<UUID, Long> activeOrderCounts = List.of(
				userRepository.findActiveTransportSpecialistCandidates(),
				userRepository.findActiveFleetRouteCoordinatorCandidates()).stream()
				.flatMap(List::stream)
				.collect(Collectors.toMap(StaffCandidateResponse::id, StaffCandidateResponse::activeOrderCount));
		return assignments.stream().map(assignment -> {
			UserAccount user = users.get(assignment.getUserId());
			return new OrderStaffAssignmentResponse(assignment.getAssignmentRole(), assignment.getUserId(),
					user == null ? null : user.getFullName(), user == null ? null : user.getEmail(),
					activeOrderCounts.getOrDefault(assignment.getUserId(), 0L), assignment.getAssignedBy(),
					assignment.getAssignedAt());
		}).toList();
	}
}
