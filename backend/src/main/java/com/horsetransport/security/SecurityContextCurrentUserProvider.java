package com.horsetransport.security;

import java.util.UUID;

import com.horsetransport.user.UserRole;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class SecurityContextCurrentUserProvider implements CurrentUserProvider {

	@Override
	public UUID getCurrentUserId() {
		Authentication authentication = currentAuthentication();

		try {
			return UUID.fromString(authentication.getName());
		}
		catch (IllegalArgumentException exception) {
			throw new CurrentUserUnavailableException("The authenticated user identifier is invalid");
		}
	}

	@Override
	public UserRole getCurrentUserRole() {
		return currentAuthentication().getAuthorities().stream()
				.map(authority -> authority.getAuthority())
				.filter(authority -> authority.startsWith("ROLE_"))
				.map(authority -> authority.substring("ROLE_".length()))
				.map(this::parseRole)
				.findFirst()
				.orElseThrow(() -> new CurrentUserUnavailableException("The authenticated user role is invalid"));
	}

	private Authentication currentAuthentication() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null || !authentication.isAuthenticated()
				|| authentication instanceof AnonymousAuthenticationToken) {
			throw new CurrentUserUnavailableException("An authenticated user is required");
		}
		return authentication;
	}

	private UserRole parseRole(String role) {
		try {
			return UserRole.valueOf(role);
		}
		catch (IllegalArgumentException exception) {
			throw new CurrentUserUnavailableException("The authenticated user role is invalid");
		}
	}
}
