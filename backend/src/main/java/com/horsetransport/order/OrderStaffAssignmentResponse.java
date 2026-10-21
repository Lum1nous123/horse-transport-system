package com.horsetransport.order;

import java.time.LocalDateTime;
import java.util.UUID;

public record OrderStaffAssignmentResponse(
		OrderStaffRole role,
		UUID userId,
		String fullName,
		String email,
		long activeOrderCount,
		UUID assignedBy,
		LocalDateTime assignedAt) {
}
