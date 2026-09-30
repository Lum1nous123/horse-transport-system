package com.horsetransport.document;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.horsetransport.common.api.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class DocumentVersionControllerTest {

	private static final UUID DOCUMENT_ID = UUID.fromString("44444444-4444-4444-4444-444444444444");
	private static final UUID VERSION_ID = UUID.fromString("55555555-5555-5555-5555-555555555555");
	private DocumentVersionService service;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		service = org.mockito.Mockito.mock(DocumentVersionService.class);
		mockMvc = MockMvcBuilders.standaloneSetup(new DocumentVersionController(service))
				.setControllerAdvice(new GlobalExceptionHandler()).build();
	}

	@Test
	void exposesCreateReplaceDeleteSubmitAndHistory() throws Exception {
		DocumentVersionResponse response = response();
		when(service.create(any(), any(), any())).thenReturn(response);
		when(service.replace(any(), any(), any(), any())).thenReturn(response);
		when(service.submit(any(), any())).thenReturn(response);
		when(service.history(DOCUMENT_ID)).thenReturn(List.of(response));
		MockMultipartFile file = new MockMultipartFile("file", "document.pdf", "application/pdf",
				new byte[] {1});

		mockMvc.perform(multipart("/api/v1/documents/{documentId}/versions", DOCUMENT_ID)
				.file(file).param("expiryDate", "2027-01-01"))
				.andExpect(status().isCreated()).andExpect(jsonPath("$.versionNo").value(1));
		mockMvc.perform(multipart(HttpMethod.PUT,
				"/api/v1/documents/{documentId}/versions/{versionId}", DOCUMENT_ID, VERSION_ID)
				.file(file)).andExpect(status().isOk());
		mockMvc.perform(delete("/api/v1/documents/{documentId}/versions/{versionId}",
				DOCUMENT_ID, VERSION_ID)).andExpect(status().isNoContent());
		mockMvc.perform(post("/api/v1/documents/{documentId}/versions/{versionId}/submit",
				DOCUMENT_ID, VERSION_ID)).andExpect(status().isOk());
		mockMvc.perform(get("/api/v1/documents/{documentId}/versions", DOCUMENT_ID))
				.andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(VERSION_ID.toString()));
	}

	@Test
	void malformedExpiryAndLifecycleErrorsUseProjectErrorContract() throws Exception {
		MockMultipartFile file = new MockMultipartFile("file", "document.pdf", "application/pdf",
				new byte[] {1});
		when(service.submit(DOCUMENT_ID, VERSION_ID))
				.thenThrow(new DocumentVersionConflictException("conflict"));

		mockMvc.perform(multipart("/api/v1/documents/{documentId}/versions", DOCUMENT_ID)
				.file(file).param("expiryDate", "invalid"))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
		mockMvc.perform(post("/api/v1/documents/{documentId}/versions/{versionId}/submit",
				DOCUMENT_ID, VERSION_ID)).andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("DOCUMENT_VERSION_CONFLICT"));
	}

	private DocumentVersionResponse response() {
		return new DocumentVersionResponse(VERSION_ID, DOCUMENT_ID, 1, DocumentVersionStatus.DRAFT, true,
				"https://res.cloudinary.com/test/document.pdf", LocalDate.of(2027, 1, 1),
				LocalDateTime.of(2026, 9, 29, 12, 0), null, null, null);
	}
}
