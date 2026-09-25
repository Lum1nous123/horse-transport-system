package com.horsetransport.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import com.horsetransport.user.UserStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

class AuthServiceTest {

	private static final String JWT_SECRET = "01234567890123456789012345678901";

	private UserRepository userRepository;
	private PasswordEncoder passwordEncoder;
	private JwtService jwtService;
	private AuthService authService;

	@BeforeEach
	void setUp() {
		userRepository = mock(UserRepository.class);
		passwordEncoder = new BCryptPasswordEncoder();
		jwtService = new JwtService(JWT_SECRET, "horse-transport-system", 60);
		authService = new AuthService(userRepository, passwordEncoder, jwtService);
	}

	@Test
	void registersActiveCustomerWithHashedPassword() {
		RegisterRequest request = new RegisterRequest(
				"Customer One", " Customer@Example.com ", " 0900000000 ", "password123");
		when(userRepository.existsByEmailIgnoreCase("customer@example.com")).thenReturn(false);
		when(userRepository.saveAndFlush(any(UserAccount.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		MeResponse response = authService.register(request);

		ArgumentCaptor<UserAccount> captor = ArgumentCaptor.forClass(UserAccount.class);
		verify(userRepository).saveAndFlush(captor.capture());
		UserAccount saved = captor.getValue();
		assertThat(saved.getEmail()).isEqualTo("customer@example.com");
		assertThat(saved.getPhone()).isEqualTo("0900000000");
		assertThat(saved.getRole()).isEqualTo(UserRole.CUSTOMER);
		assertThat(saved.getStatus()).isEqualTo(UserStatus.ACTIVE);
		assertThat(saved.getPasswordHash()).isNotEqualTo(request.password());
		assertThat(passwordEncoder.matches(request.password(), saved.getPasswordHash())).isTrue();
		assertThat(response.role()).isEqualTo(UserRole.CUSTOMER);
	}

	@Test
	void rejectsDuplicateEmail() {
		when(userRepository.existsByEmailIgnoreCase("customer@example.com")).thenReturn(true);

		assertThatThrownBy(() -> authService.register(new RegisterRequest(
				"Customer One", "customer@example.com", null, "password123")))
				.isInstanceOf(DuplicateEmailException.class);
	}

	@Test
	void logsInWithValidCredentials() {
		UserAccount user = UserAccount.registerCustomer(
				"Customer One", "customer@example.com", null, passwordEncoder.encode("password123"));
		when(userRepository.findByEmailIgnoreCase("customer@example.com")).thenReturn(Optional.of(user));

		LoginResponse response = authService.login(new LoginRequest("CUSTOMER@example.com", "password123"));

		JwtService.VerifiedJwt jwt = jwtService.verify(response.accessToken());
		assertThat(response.tokenType()).isEqualTo("Bearer");
		assertThat(response.expiresInSeconds()).isEqualTo(3600);
		assertThat(jwt.userId()).isEqualTo(user.getId());
		assertThat(jwt.role()).isEqualTo(UserRole.CUSTOMER);
	}

	@Test
	void rejectsInvalidPassword() {
		UserAccount user = UserAccount.registerCustomer(
				"Customer One", "customer@example.com", null, passwordEncoder.encode("password123"));
		when(userRepository.findByEmailIgnoreCase("customer@example.com")).thenReturn(Optional.of(user));

		assertThatThrownBy(() -> authService.login(new LoginRequest("customer@example.com", "wrong-password")))
				.isInstanceOf(InvalidCredentialsException.class);
	}

	@Test
	void rejectsInactiveAccount() {
		UserAccount user = mock(UserAccount.class);
		when(user.getStatus()).thenReturn(UserStatus.INACTIVE);
		when(userRepository.findByEmailIgnoreCase("customer@example.com")).thenReturn(Optional.of(user));

		assertThatThrownBy(() -> authService.login(new LoginRequest("customer@example.com", "password123")))
				.isInstanceOf(InvalidCredentialsException.class);
	}
}
