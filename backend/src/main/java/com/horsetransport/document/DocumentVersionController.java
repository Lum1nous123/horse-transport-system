package com.horsetransport.document;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/documents/{documentId}/versions")
public class DocumentVersionController {

	private final DocumentVersionService service;

	public DocumentVersionController(DocumentVersionService service) {
		this.service = service;
	}

	@PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public ResponseEntity<DocumentVersionResponse> create(@PathVariable UUID documentId,
			@RequestParam("file") MultipartFile file,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate expiryDate) {
		return ResponseEntity.status(HttpStatus.CREATED).body(service.create(documentId, file, expiryDate));
	}

	@PutMapping(value = "/{versionId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public ResponseEntity<DocumentVersionResponse> replace(@PathVariable UUID documentId,
			@PathVariable UUID versionId, @RequestParam("file") MultipartFile file,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate expiryDate) {
		return ResponseEntity.ok(service.replace(documentId, versionId, file, expiryDate));
	}

	@DeleteMapping("/{versionId}")
	public ResponseEntity<Void> delete(@PathVariable UUID documentId, @PathVariable UUID versionId) {
		service.deleteDraft(documentId, versionId);
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/{versionId}/submit")
	public ResponseEntity<DocumentVersionResponse> submit(@PathVariable UUID documentId,
			@PathVariable UUID versionId) {
		return ResponseEntity.ok(service.submit(documentId, versionId));
	}

	@GetMapping
	public ResponseEntity<List<DocumentVersionResponse>> history(@PathVariable UUID documentId) {
		return ResponseEntity.ok(service.history(documentId));
	}
}
