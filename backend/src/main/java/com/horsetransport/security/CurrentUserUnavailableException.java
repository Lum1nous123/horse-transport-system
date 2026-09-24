package com.horsetransport.security;

public class CurrentUserUnavailableException extends RuntimeException {

	public CurrentUserUnavailableException(String message) {
		super(message);
	}
}
