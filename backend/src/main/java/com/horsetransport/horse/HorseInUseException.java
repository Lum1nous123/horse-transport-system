package com.horsetransport.horse;

public class HorseInUseException extends RuntimeException {

	public HorseInUseException() {
		super("Remove this horse from every transport order before deleting its profile");
	}

}
