package com.horsetransport.auth;

import java.util.UUID;

import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRole;
import com.horsetransport.user.UserStatus;

public record MeResponse(
		UUID id,
		String fullName,
		String email,
		String phone,
		UserRole role,
		UserStatus status) {

	static MeResponse from(UserAccount user) {
		return new MeResponse(
				user.getId(),
				user.getFullName(),
				user.getEmail(),
				user.getPhone(),
				user.getRole(),
				user.getStatus());
	}
}
