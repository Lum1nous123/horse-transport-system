package com.horsetransport.auth;

import java.util.Locale;
import java.util.UUID;

import com.horsetransport.security.CurrentUserUnavailableException;
import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserStatus;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;
	private final JwtService jwtService;

	public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.jwtService = jwtService;
	}

	@Transactional
	public MeResponse register(RegisterRequest request) {
		String email = normalizeEmail(request.email());
		if (userRepository.existsByEmailIgnoreCase(email)) {
			throw new DuplicateEmailException();
		}

		UserAccount user = UserAccount.registerCustomer(
				request.fullName().trim(),
				email,
				normalizeOptional(request.phone()),
				passwordEncoder.encode(request.password()));

		try {
			return MeResponse.from(userRepository.saveAndFlush(user));
		}
		catch (DataIntegrityViolationException exception) {
			if (containsConstraint(exception, "users_email_key")) {
				throw new DuplicateEmailException();
			}
			throw exception;
		}
	}

	@Transactional(readOnly = true)
	public LoginResponse login(LoginRequest request) {
		UserAccount user = userRepository.findByEmailIgnoreCase(normalizeEmail(request.email()))
				.filter(account -> account.getStatus() == UserStatus.ACTIVE)
				.orElseThrow(InvalidCredentialsException::new);

		if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
			throw new InvalidCredentialsException();
		}

		return new LoginResponse(jwtService.createToken(user), "Bearer", jwtService.getExpirationSeconds());
	}

	@Transactional(readOnly = true)
	public MeResponse getCurrentUser(UUID userId) {
		return userRepository.findById(userId)
				.filter(account -> account.getStatus() == UserStatus.ACTIVE)
				.map(MeResponse::from)
				.orElseThrow(() -> new CurrentUserUnavailableException("The current user is unavailable"));
	}

	private String normalizeEmail(String email) {
		return email.trim().toLowerCase(Locale.ROOT);
	}

	private String normalizeOptional(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}

	private boolean containsConstraint(Throwable exception, String constraintName) {
		Throwable cause = exception;
		while (cause != null) {
			if (cause.getMessage() != null && cause.getMessage().contains(constraintName)) {
				return true;
			}
			cause = cause.getCause();
		}
		return false;
	}
}
