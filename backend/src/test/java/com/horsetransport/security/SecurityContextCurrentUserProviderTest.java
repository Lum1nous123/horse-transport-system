package com.horsetransport.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.UUID;

import com.horsetransport.user.UserRole;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

class SecurityContextCurrentUserProviderTest {

	private final SecurityContextCurrentUserProvider provider = new SecurityContextCurrentUserProvider();

	@AfterEach
	void clearContext() {
		SecurityContextHolder.clearContext();
	}

	@Test
	void readsCurrentUserIdFromSecurityContext() {
		UUID userId = UUID.fromString("11111111-1111-1111-1111-111111111111");
		SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
				userId.toString(), null, List.of(new SimpleGrantedAuthority("ROLE_CUSTOMER"))));

		assertThat(provider.getCurrentUserId()).isEqualTo(userId);
		assertThat(provider.getCurrentUserRole()).isEqualTo(UserRole.CUSTOMER);
	}

	@Test
	void rejectsMissingAuthentication() {
		assertThatThrownBy(provider::getCurrentUserId)
				.isInstanceOf(CurrentUserUnavailableException.class);
	}
}
