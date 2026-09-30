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
		when(service.findOrderDetail(ORDER_ID)).thenReturn(response(OrderStatus.DRAFT));
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
	void exposesSubmittedOrderInbox() throws Exception {
		OrderInboxResponse item = new OrderInboxResponse(ORDER_ID, "ORD-test", OrderStatus.SUBMITTED,
				"Hanoi", null, "Da Nang", null, TransportMode.ROAD,
				LocalDateTime.of(2026, 10, 1, 9, 0), 2, LocalDateTime.now());
		when(service.findLogisticsManagerInbox(OrderStatus.SUBMITTED)).thenReturn(List.of(item));

		mockMvc.perform(get("/api/v1/orders/inbox").queryParam("status", "SUBMITTED"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].id").value(ORDER_ID.toString()))
				.andExpect(jsonPath("$[0].status").value("SUBMITTED"))
				.andExpect(jsonPath("$[0].horseCount").value(2));
	}

	@Test
	void exposesTransportSpecialistDocumentInboxWithDeadlineFields() throws Exception {
		LocalDateTime deadline = LocalDateTime.of(2026, 10, 15, 17, 0);
		LocalDateTime deadlineSetAt = LocalDateTime.of(2026, 10, 2, 10, 30);
		DocumentInboxResponse item = new DocumentInboxResponse(ORDER_ID, "ORD-test", OrderStatus.APPROVED,
				"Hanoi", null, "Da Nang", null, LocalDateTime.of(2026, 10, 20, 9, 0), 2,
				deadline, deadlineSetAt, LocalDateTime.now());
		when(service.findTransportSpecialistDocumentInbox()).thenReturn(List.of(item));

		mockMvc.perform(get("/api/v1/orders/document-inbox"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].id").value(ORDER_ID.toString()))
				.andExpect(jsonPath("$[0].status").value("APPROVED"))
				.andExpect(jsonPath("$[0].horseCount").value(2))
				.andExpect(jsonPath("$[0].documentCompletionDeadlineAt").value("2026-10-15T17:00:00"))
				.andExpect(jsonPath("$[0].documentDeadlineSetAt").value("2026-10-02T10:30:00"));
	}

	@Test
	void rejectsUnsupportedInboxStatus() throws Exception {
		when(service.findLogisticsManagerInbox(OrderStatus.DRAFT))
				.thenThrow(new UnsupportedOrderInboxStatusException());

		mockMvc.perform(get("/api/v1/orders/inbox").queryParam("status", "DRAFT"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("UNSUPPORTED_ORDER_INBOX_STATUS"));
	}

	@Test
	void exposesCancelAndRejectEndpoints() throws Exception {
		when(service.cancel(ORDER_ID)).thenReturn(response(OrderStatus.CANCELLED));
		when(service.reject(any(), any())).thenReturn(response(OrderStatus.REJECTED));

		mockMvc.perform(post("/api/v1/orders/{id}/cancel", ORDER_ID))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("CANCELLED"));
		mockMvc.perform(post("/api/v1/orders/{id}/reject", ORDER_ID)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"rejectionReason":"Insufficient information"}
						"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("REJECTED"));
	}

	@Test
	void rejectsBlankRejectionReason() throws Exception {
		mockMvc.perform(post("/api/v1/orders/{id}/reject", ORDER_ID)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"rejectionReason":"   "}
						"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
	}

	@Test
	void returnsConflictForInvalidTransition() throws Exception {
		when(service.cancel(ORDER_ID))
				.thenThrow(new InvalidOrderTransitionException(OrderStatus.APPROVED, "cancelled"));

		mockMvc.perform(post("/api/v1/orders/{id}/cancel", ORDER_ID))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("INVALID_ORDER_TRANSITION"));
	}

	@Test
	void returnsNotFoundForUnownedOrder() throws Exception {
		when(service.findOrderDetail(ORDER_ID)).thenThrow(new OrderNotFoundException());
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
				null, null, null, null, List.of(), null, null, null, null, status, LocalDateTime.now(), null);
	}
}
