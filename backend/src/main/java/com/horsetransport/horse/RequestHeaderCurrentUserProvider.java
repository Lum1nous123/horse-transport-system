package com.horsetransport.horse;

import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("local")
class RequestHeaderCurrentUserProvider implements CurrentUserProvider {

	static final String CURRENT_USER_HEADER = "X-Current-User-Id";

	private final HttpServletRequest request;

	RequestHeaderCurrentUserProvider(HttpServletRequest request) {
		this.request = request;
	}

	@Override
	public UUID getCurrentUserId() {
		String currentUserId = request.getHeader(CURRENT_USER_HEADER);
		if (currentUserId == null || currentUserId.isBlank()) {
			throw new CurrentUserUnavailableException(
					CURRENT_USER_HEADER + " header is required for local and test requests");
		}

		try {
			return UUID.fromString(currentUserId);
		}
		catch (IllegalArgumentException exception) {
			throw new CurrentUserUnavailableException(
					CURRENT_USER_HEADER + " header must contain a valid UUID");
		}
	}

}
