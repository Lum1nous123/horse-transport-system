package com.horsetransport.auth;

import com.horsetransport.security.CurrentUserProvider;
import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

	private final AuthService authService;
	private final CurrentUserProvider currentUserProvider;

	public AuthController(AuthService authService, CurrentUserProvider currentUserProvider) {
		this.authService = authService;
		this.currentUserProvider = currentUserProvider;
	}

	@PostMapping("/register")
	@ResponseStatus(HttpStatus.CREATED)
	public MeResponse register(@Valid @RequestBody RegisterRequest request) {
		return authService.register(request);
	}

	@PostMapping("/login")
	public LoginResponse login(@Valid @RequestBody LoginRequest request) {
		return authService.login(request);
	}

	@GetMapping("/me")
	public MeResponse me() {
		return authService.getCurrentUser(currentUserProvider.getCurrentUserId());
	}
}
