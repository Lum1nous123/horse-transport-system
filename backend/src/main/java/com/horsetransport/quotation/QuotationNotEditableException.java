package com.horsetransport.quotation;

public class QuotationNotEditableException extends RuntimeException {
	public QuotationNotEditableException() {
		super("Only a draft quotation for a submitted order can be edited");
	}
}
