package com.horsetransport.document;

public class DocumentVersionNotFoundException extends RuntimeException {
	public DocumentVersionNotFoundException() {
		super("Document version was not found");
	}
}
