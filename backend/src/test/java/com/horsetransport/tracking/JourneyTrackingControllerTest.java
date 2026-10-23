package com.horsetransport.tracking;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.horsetransport.order.OrderStatus;
import com.horsetransport.route.RoutePlanStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class JourneyTrackingControllerTest {

	private static final UUID ORDER_ID = UUID.randomUUID();
	private JourneyTrackingService service;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		service = mock(JourneyTrackingService.class);
		mockMvc = MockMvcBuilders.standaloneSetup(new JourneyTrackingController(service)).build();
	}

	@Test
	void exposesOrderTrackingEndpoint() throws Exception {
		when(service.getTracking(ORDER_ID)).thenReturn(new JourneyTrackingResponse(
				ORDER_ID, "ORD-TRACKING", OrderStatus.IN_PROGRESS, "Origin", "US",
				"Destination", "BE", LocalDateTime.of(2026, 10, 23, 8, 0), null,
				UUID.randomUUID(), RoutePlanStatus.APPROVED,
				LocalDateTime.of(2026, 10, 22, 8, 0), List.of()));

		mockMvc.perform(get("/api/v1/orders/{orderId}/tracking", ORDER_ID))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.orderId").value(ORDER_ID.toString()))
				.andExpect(jsonPath("$.orderCode").value("ORD-TRACKING"))
				.andExpect(jsonPath("$.legs").isArray());
	}
}
