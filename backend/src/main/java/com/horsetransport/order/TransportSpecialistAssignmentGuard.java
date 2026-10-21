package com.horsetransport.order;

import java.util.UUID;

import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserRole;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

@Component
public class TransportSpecialistAssignmentGuard {
	private final OrderStaffAssignmentRepository assignmentRepository;
	private final CurrentUserProvider currentUserProvider;

	public TransportSpecialistAssignmentGuard(OrderStaffAssignmentRepository assignmentRepository,
			CurrentUserProvider currentUserProvider) {
		this.assignmentRepository = assignmentRepository;
		this.currentUserProvider = currentUserProvider;
	}

	public void requireAssignedToCurrentTransportSpecialist(UUID orderId) {
		if (currentUserProvider.getCurrentUserRole() != UserRole.TRANSPORT_SPECIALIST
				|| !assignmentRepository.existsByTransportOrderIdAndAssignmentRoleAndUserId(orderId,
						OrderStaffRole.TRANSPORT_SPECIALIST, currentUserProvider.getCurrentUserId())) {
			throw new UnassignedTransportSpecialistException();
		}
	}
}
