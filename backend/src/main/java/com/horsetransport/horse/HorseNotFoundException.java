package com.horsetransport.horse;

public class HorseNotFoundException extends RuntimeException {

	public HorseNotFoundException() {
		super("Horse profile not found");
	}

}
