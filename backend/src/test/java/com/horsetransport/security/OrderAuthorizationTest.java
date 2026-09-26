package com.horsetransport.security;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.horsetransport.auth.JwtAuthenticationFilter;
import com.horsetransport.auth.JwtService;
import com.horsetransport.order.TransportOrderController;
import com.horsetransport.order.TransportOrderService;
import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import com.horsetransport.user.UserStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(TransportOrderController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtService.class})
@TestPropertySource(properties = {
		"app.security.jwt.secret=01234567890123456789012345678901",
		"app.security.jwt.issuer=horse-transport-system",
		"app.security.jwt.expiration-minutes=60"
})
class OrderAuthorizationTest {
	private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

	@Autowired private MockMvc mockMvc;
	@Autowired private JwtService jwtService;
	@MockitoBean private TransportOrderService orderService;
	@MockitoBean private UserRepository userRepository;

	@Test
	void allowsCustomer() throws Exception {
		UserAccount customer = user(UserRole.CUSTOMER);
		when(userRepository.findById(USER_ID)).thenReturn(Optional.of(customer));
		when(orderService.findCurrentCustomerOrders()).thenReturn(List.of());

		mockMvc.perform(get("/api/v1/orders")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + jwtService.createToken(customer)))
				.andExpect(status().isOk());
	}

	@Test
	void rejectsNonCustomerWithForbidden() throws Exception {
		UserAccount manager = user(UserRole.LOGISTICS_MANAGER);
		when(userRepository.findById(USER_ID)).thenReturn(Optional.of(manager));

		mockMvc.perform(get("/api/v1/orders")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + jwtService.createToken(manager)))
				.andExpect(status().isForbidden());
	}

	private UserAccount user(UserRole role) {
		UserAccount user = mock(UserAccount.class);
		when(user.getId()).thenReturn(USER_ID);
		when(user.getRole()).thenReturn(role);
		when(user.getStatus()).thenReturn(UserStatus.ACTIVE);
		return user;
	}
}
