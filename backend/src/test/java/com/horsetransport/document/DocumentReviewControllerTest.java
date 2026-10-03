package com.horsetransport.document;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.util.UUID;

import com.horsetransport.common.api.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class DocumentReviewControllerTest {

	private static final UUID DOCUMENT_ID = UUID.fromString("44444444-4444-4444-4444-444444444444");
	private static final UUID VERSION_ID = UUID.fromString("55555555-5555-5555-5555-555555555555");
	private DocumentReviewService service;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		service = org.mockito.Mockito.mock(DocumentReviewService.class);
		mockMvc = MockMvcBuilders.standaloneSetup(new DocumentReviewController(service))
				.setControllerAdvice(new GlobalExceptionHandler()).build();
	}

	@Test
	void exposesApproveAndRejectEndpoints() throws Exception {
		when(service.approve(DOCUMENT_ID, VERSION_ID)).thenReturn(response(DocumentVersionStatus.APPROVED, null));
		when(service.reject(any(), any(), any())).thenReturn(
				response(DocumentVersionStatus.REJECTED, "Invalid certificate"));

		mockMvc.perform(post(path("approve"))).andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("APPROVED"));
		mockMvc.perform(post(path("reject")).contentType(MediaType.APPLICATION_JSON)
				.content("{\"rejectionReason\":\"Invalid certificate\"}"))
				.andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REJECTED"))
				.andExpect(jsonPath("$.rejectionReason").value("Invalid certificate"));
	}

	@Test
	void blankRejectionReasonIsBadRequest() throws Exception {
		mockMvc.perform(post(path("reject")).contentType(MediaType.APPLICATION_JSON)
				.content("{\"rejectionReason\":\"   \"}"))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		mockMvc.perform(post(path("reject")).contentType(MediaType.APPLICATION_JSON).content("{}"))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
	}

	@Test
	void lifecycleConflictUsesExistingErrorContract() throws Exception {
		when(service.approve(DOCUMENT_ID, VERSION_ID))
				.thenThrow(new DocumentVersionConflictException("conflict"));

		mockMvc.perform(post(path("approve"))).andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("DOCUMENT_VERSION_CONFLICT"));
	}

	private String path(String action) {
		return "/api/v1/documents/" + DOCUMENT_ID + "/versions/" + VERSION_ID + "/" + action;
	}

	private DocumentVersionResponse response(DocumentVersionStatus status, String reason) {
		return new DocumentVersionResponse(VERSION_ID, DOCUMENT_ID, 1, status, true,
				"https://example.test/document.pdf", "horse-passport.pdf", null, LocalDateTime.of(2026, 9, 29, 12, 0),
				LocalDateTime.of(2026, 9, 29, 13, 0), LocalDateTime.of(2026, 9, 29, 14, 0), reason);
	}
}
