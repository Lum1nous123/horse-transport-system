package com.horsetransport.document;

import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/orders/{orderId}/documents")
public class DocumentChecklistController {

	private final DocumentChecklistService service;

	public DocumentChecklistController(DocumentChecklistService service) {
		this.service = service;
	}

	@GetMapping("/checklist")
	public ResponseEntity<DocumentChecklistResponse> getChecklist(@PathVariable UUID orderId) {
		return ResponseEntity.ok(service.getChecklist(orderId));
	}

	@PutMapping("/deadline")
	public ResponseEntity<DocumentDeadlineResponse> setDeadline(@PathVariable UUID orderId,
			@Valid @RequestBody SetDocumentDeadlineRequest request) {
		return ResponseEntity.ok(service.setDeadline(orderId, request));
	}
}
