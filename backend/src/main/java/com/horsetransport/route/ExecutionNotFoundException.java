package com.horsetransport.route;

public class ExecutionNotFoundException extends RuntimeException {
	public ExecutionNotFoundException() {
		super("Execution was not found");
	}
}
