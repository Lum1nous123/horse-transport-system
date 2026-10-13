package com.horsetransport.order;

import java.time.LocalDateTime;
import java.util.UUID;

public record OrderStaffAssignmentResponse(
		OrderStaffRole role,
		UUID userId,
		String fullName,
		UUID assignedBy,
		LocalDateTime assignedAt) {
}
