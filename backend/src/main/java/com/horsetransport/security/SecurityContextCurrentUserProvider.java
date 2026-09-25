package com.horsetransport.security;

import java.util.UUID;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class SecurityContextCurrentUserProvider implements CurrentUserProvider {

	@Override
	public UUID getCurrentUserId() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null || !authentication.isAuthenticated()
				|| authentication instanceof AnonymousAuthenticationToken) {
			throw new CurrentUserUnavailableException("An authenticated user is required");
		}

		try {
			return UUID.fromString(authentication.getName());
		}
		catch (IllegalArgumentException exception) {
			throw new CurrentUserUnavailableException("The authenticated user identifier is invalid");
		}
	}
}
