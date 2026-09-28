package com.horsetransport.quotation;

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

class QuotationControllerTest {

	private static final UUID ORDER_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
	private QuotationService service;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		service = org.mockito.Mockito.mock(QuotationService.class);
		mockMvc = MockMvcBuilders.standaloneSetup(new QuotationController(service))
				.setControllerAdvice(new GlobalExceptionHandler()).build();
	}

	@Test
	void exposesCreateUpdateGetAndSendEndpoints() throws Exception {
		when(service.create(ORDER_ID)).thenReturn(response(QuotationStatus.DRAFT));
		when(service.update(any(), any())).thenReturn(response(QuotationStatus.DRAFT));
		when(service.get(ORDER_ID)).thenReturn(response(QuotationStatus.DRAFT));
		when(service.send(ORDER_ID)).thenReturn(response(QuotationStatus.SENT));

		mockMvc.perform(post("/api/v1/orders/{id}/quotation", ORDER_ID))
				.andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("DRAFT"));
		mockMvc.perform(put("/api/v1/orders/{id}/quotation", ORDER_ID)
				.contentType(MediaType.APPLICATION_JSON).content("{}"))
				.andExpect(status().isOk()).andExpect(jsonPath("$.currency").value("USD"));
		mockMvc.perform(get("/api/v1/orders/{id}/quotation", ORDER_ID))
				.andExpect(status().isOk());
		mockMvc.perform(post("/api/v1/orders/{id}/quotation/send", ORDER_ID))
				.andExpect(status().isOk()).andExpect(jsonPath("$.status").value("SENT"));
	}

	@Test
	void rejectsInvalidLineItemInput() throws Exception {
		mockMvc.perform(put("/api/v1/orders/{id}/quotation", ORDER_ID)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"lineItems":[{"sequenceNo":0,"description":" ","amount":0}]}
						"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
	}

	@Test
	void mapsQuotationBusinessErrors() throws Exception {
		when(service.create(ORDER_ID)).thenThrow(new DuplicateQuotationException());
		when(service.get(ORDER_ID)).thenThrow(new QuotationNotFoundException());
		when(service.send(ORDER_ID)).thenThrow(new QuotationNotEditableException());

		mockMvc.perform(post("/api/v1/orders/{id}/quotation", ORDER_ID))
				.andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_QUOTATION"));
		mockMvc.perform(get("/api/v1/orders/{id}/quotation", ORDER_ID))
				.andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("QUOTATION_NOT_FOUND"));
		mockMvc.perform(post("/api/v1/orders/{id}/quotation/send", ORDER_ID))
				.andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("QUOTATION_NOT_EDITABLE"));
	}

	private QuotationResponse response(QuotationStatus status) {
		return new QuotationResponse(UUID.randomUUID(), ORDER_ID, null, null, null, "USD", null, status,
				UUID.randomUUID(), status == QuotationStatus.SENT ? LocalDateTime.now() : null,
				LocalDateTime.now(), null, List.of());
	}
}
