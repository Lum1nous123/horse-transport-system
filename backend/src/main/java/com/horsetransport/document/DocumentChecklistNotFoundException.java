package com.horsetransport.document;

public class DocumentChecklistNotFoundException extends RuntimeException {

	public DocumentChecklistNotFoundException() {
		super("Document checklist was not found");
	}
}
