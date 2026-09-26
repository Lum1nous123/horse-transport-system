package com.horsetransport.order;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.horsetransport.common.api.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class TransportOrderControllerTest {
	private static final UUID ORDER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
	private TransportOrderService service;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		service = org.mockito.Mockito.mock(TransportOrderService.class);
		mockMvc = MockMvcBuilders.standaloneSetup(new TransportOrderController(service))
				.setControllerAdvice(new GlobalExceptionHandler()).build();
	}

	@Test
	void exposesCreateListDetailEditAndSubmitEndpoints() throws Exception {
		when(service.create(any())).thenReturn(response(OrderStatus.DRAFT));
		when(service.findCurrentCustomerOrders()).thenReturn(List.of(response(OrderStatus.DRAFT)));
		when(service.findCurrentCustomerOrder(ORDER_ID)).thenReturn(response(OrderStatus.DRAFT));
		when(service.update(any(), any())).thenReturn(response(OrderStatus.DRAFT));
		when(service.submit(ORDER_ID)).thenReturn(response(OrderStatus.SUBMITTED));

		mockMvc.perform(post("/api/v1/orders").contentType(MediaType.APPLICATION_JSON).content("{}"))
				.andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("DRAFT"));
		mockMvc.perform(get("/api/v1/orders"))
				.andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(ORDER_ID.toString()));
		mockMvc.perform(get("/api/v1/orders/{id}", ORDER_ID))
				.andExpect(status().isOk());
		mockMvc.perform(put("/api/v1/orders/{id}", ORDER_ID).contentType(MediaType.APPLICATION_JSON).content("{}"))
				.andExpect(status().isOk());
		mockMvc.perform(post("/api/v1/orders/{id}/submit", ORDER_ID))
				.andExpect(status().isOk()).andExpect(jsonPath("$.status").value("SUBMITTED"));
	}

	@Test
	void returnsNotFoundForUnownedOrder() throws Exception {
		when(service.findCurrentCustomerOrder(ORDER_ID)).thenThrow(new OrderNotFoundException());
		mockMvc.perform(get("/api/v1/orders/{id}", ORDER_ID))
				.andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ORDER_NOT_FOUND"));
	}

	@Test
	void returnsConflictWhenSubmittedOrderIsEdited() throws Exception {
		when(service.update(any(), any())).thenThrow(new OrderNotEditableException());
		mockMvc.perform(put("/api/v1/orders/{id}", ORDER_ID).contentType(MediaType.APPLICATION_JSON).content("{}"))
				.andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ORDER_NOT_EDITABLE"));
	}

	private OrderResponse response(OrderStatus status) {
		return new OrderResponse(ORDER_ID, "ORD-test", null, null, null, null, null, null,
				null, null, null, null, List.of(), status, LocalDateTime.now(), null);
	}
}
