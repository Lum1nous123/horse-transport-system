package com.horsetransport.quotation;

public class QuotationNotFoundException extends RuntimeException {
	public QuotationNotFoundException() {
		super("Quotation was not found");
	}
}
