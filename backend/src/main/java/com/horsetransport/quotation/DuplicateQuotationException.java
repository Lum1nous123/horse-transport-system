package com.horsetransport.quotation;

public class DuplicateQuotationException extends RuntimeException {
	public DuplicateQuotationException() {
		super("Transport order already has a quotation");
	}
}
