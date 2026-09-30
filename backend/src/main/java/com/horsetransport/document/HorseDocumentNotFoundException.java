package com.horsetransport.document;

public class HorseDocumentNotFoundException extends RuntimeException {
	public HorseDocumentNotFoundException() {
		super("Horse document was not found");
	}
}
