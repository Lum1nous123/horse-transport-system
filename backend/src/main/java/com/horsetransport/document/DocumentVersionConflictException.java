package com.horsetransport.document;

public class DocumentVersionConflictException extends RuntimeException {
	public DocumentVersionConflictException(String message) {
		super(message);
	}
}
