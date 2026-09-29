package com.horsetransport.document;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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

class DocumentChecklistControllerTest {

	private static final UUID ORDER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
	private DocumentChecklistService service;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		service = org.mockito.Mockito.mock(DocumentChecklistService.class);
		mockMvc = MockMvcBuilders.standaloneSetup(new DocumentChecklistController(service))
				.setControllerAdvice(new GlobalExceptionHandler()).build();
	}

	@Test
	void exposesChecklistAndDeadlineEndpoints() throws Exception {
		LocalDateTime deadline = LocalDateTime.of(2026, 10, 15, 17, 0);
		when(service.getChecklist(ORDER_ID)).thenReturn(new DocumentChecklistResponse(ORDER_ID, null, null, List.of()));
		when(service.setDeadline(any(), any())).thenReturn(new DocumentDeadlineResponse(ORDER_ID, deadline, deadline));

		mockMvc.perform(get("/api/v1/orders/{id}/documents/checklist", ORDER_ID))
				.andExpect(status().isOk()).andExpect(jsonPath("$.orderId").value(ORDER_ID.toString()));
		mockMvc.perform(put("/api/v1/orders/{id}/documents/deadline", ORDER_ID)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"documentCompletionDeadlineAt\":\"2026-10-15T17:00:00\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.documentCompletionDeadlineAt").value("2026-10-15T17:00:00"));
	}

	@Test
	void missingOrMalformedDeadlineIsBadRequest() throws Exception {
		mockMvc.perform(put("/api/v1/orders/{id}/documents/deadline", ORDER_ID)
				.contentType(MediaType.APPLICATION_JSON).content("{}"))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		mockMvc.perform(put("/api/v1/orders/{id}/documents/deadline", ORDER_ID)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"documentCompletionDeadlineAt\":\"not-a-timestamp\"}"))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
	}

	@Test
	void mapsChecklistErrors() throws Exception {
		when(service.getChecklist(ORDER_ID)).thenThrow(new DocumentChecklistNotFoundException());
		when(service.setDeadline(any(), any())).thenThrow(new DocumentChecklistConflictException("conflict"));

		mockMvc.perform(get("/api/v1/orders/{id}/documents/checklist", ORDER_ID))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("DOCUMENT_CHECKLIST_NOT_FOUND"));
		mockMvc.perform(put("/api/v1/orders/{id}/documents/deadline", ORDER_ID)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"documentCompletionDeadlineAt\":\"2026-10-15T17:00:00\"}"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("DOCUMENT_CHECKLIST_CONFLICT"));
	}
}
