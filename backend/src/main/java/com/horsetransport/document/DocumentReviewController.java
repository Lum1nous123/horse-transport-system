package com.horsetransport.document;

import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/documents/{documentId}/versions/{versionId}")
public class DocumentReviewController {

	private final DocumentReviewService service;

	public DocumentReviewController(DocumentReviewService service) {
		this.service = service;
	}

	@PostMapping("/approve")
	public ResponseEntity<DocumentVersionResponse> approve(@PathVariable UUID documentId,
			@PathVariable UUID versionId) {
		return ResponseEntity.ok(service.approve(documentId, versionId));
	}

	@PostMapping("/reject")
	public ResponseEntity<DocumentVersionResponse> reject(@PathVariable UUID documentId,
			@PathVariable UUID versionId, @Valid @RequestBody RejectDocumentVersionRequest request) {
		return ResponseEntity.ok(service.reject(documentId, versionId, request));
	}
}
