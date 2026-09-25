package com.horsetransport.auth;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import com.horsetransport.common.api.GlobalExceptionHandler;
import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserRole;
import com.horsetransport.user.UserStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class AuthControllerTest {

	private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

	private AuthService authService;
	private CurrentUserProvider currentUserProvider;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		authService = mock(AuthService.class);
		currentUserProvider = mock(CurrentUserProvider.class);
		mockMvc = MockMvcBuilders.standaloneSetup(new AuthController(authService, currentUserProvider))
				.setControllerAdvice(new GlobalExceptionHandler())
				.build();
	}

	@Test
	void registersCustomer() throws Exception {
		when(authService.register(any(RegisterRequest.class))).thenReturn(meResponse());

		mockMvc.perform(post("/api/v1/auth/register")
				.contentType(MediaType.APPLICATION_JSON)
				.content(registerBody()))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").value(USER_ID.toString()))
				.andExpect(jsonPath("$.role").value("CUSTOMER"))
				.andExpect(jsonPath("$.passwordHash").doesNotExist());
	}

	@Test
	void returnsConflictForDuplicateEmail() throws Exception {
		when(authService.register(any(RegisterRequest.class))).thenThrow(new DuplicateEmailException());

		mockMvc.perform(post("/api/v1/auth/register")
				.contentType(MediaType.APPLICATION_JSON)
				.content(registerBody()))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("DUPLICATE_EMAIL"));
	}

	@Test
	void logsIn() throws Exception {
		when(authService.login(any(LoginRequest.class)))
				.thenReturn(new LoginResponse("signed.jwt.token", "Bearer", 3600));

		mockMvc.perform(post("/api/v1/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{
						  "email": "customer@example.com",
						  "password": "password123"
						}
						"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.accessToken").value("signed.jwt.token"))
				.andExpect(jsonPath("$.tokenType").value("Bearer"))
				.andExpect(jsonPath("$.expiresInSeconds").value(3600));
	}

	@Test
	void rejectsInvalidCredentials() throws Exception {
		when(authService.login(any(LoginRequest.class))).thenThrow(new InvalidCredentialsException());

		mockMvc.perform(post("/api/v1/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{
						  "email": "customer@example.com",
						  "password": "wrong-password"
						}
						"""))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
	}

	@Test
	void returnsCurrentUser() throws Exception {
		when(currentUserProvider.getCurrentUserId()).thenReturn(USER_ID);
		when(authService.getCurrentUser(USER_ID)).thenReturn(meResponse());

		mockMvc.perform(get("/api/v1/auth/me"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(USER_ID.toString()))
				.andExpect(jsonPath("$.email").value("customer@example.com"))
				.andExpect(jsonPath("$.status").value("ACTIVE"));
	}

	private String registerBody() {
		return """
				{
				  "fullName": "Customer One",
				  "email": "customer@example.com",
				  "phone": "0900000000",
				  "password": "password123",
				  "role": "LOGISTICS_MANAGER"
				}
				""";
	}

	private MeResponse meResponse() {
		return new MeResponse(
				USER_ID,
				"Customer One",
				"customer@example.com",
				"0900000000",
				UserRole.CUSTOMER,
				UserStatus.ACTIVE);
	}
}
