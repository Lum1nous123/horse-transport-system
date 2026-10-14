package com.horsetransport.order;

import java.util.UUID;

import com.horsetransport.user.UserRole;

public record StaffCandidateResponse(UUID id, String fullName, String email, UserRole role, long activeOrderCount) {
}
