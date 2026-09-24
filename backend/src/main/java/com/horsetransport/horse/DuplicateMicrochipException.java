package com.horsetransport.horse;

public class DuplicateMicrochipException extends RuntimeException {

	public DuplicateMicrochipException() {
		super("A horse with this microchip ID already exists");
	}

}
