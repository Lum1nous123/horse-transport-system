package com.horsetransport.common.api;

import java.time.Instant;

import com.horsetransport.horse.CurrentUserUnavailableException;
import com.horsetransport.horse.DuplicateMicrochipException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(DuplicateMicrochipException.class)
	public ResponseEntity<ApiError> handleDuplicateMicrochip(DuplicateMicrochipException exception) {
		return error(HttpStatus.CONFLICT, "DUPLICATE_MICROCHIP", exception.getMessage());
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
		String message = exception.getBindingResult().getFieldErrors().stream()
				.findFirst()
				.map(fieldError -> fieldError.getField() + ": " + fieldError.getDefaultMessage())
				.orElse("Request validation failed");
		return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", message);
	}

	@ExceptionHandler(HttpMessageNotReadableException.class)
	public ResponseEntity<ApiError> handleUnreadableRequest() {
		return error(HttpStatus.BAD_REQUEST, "MALFORMED_REQUEST", "Request body is malformed");
	}

	@ExceptionHandler(CurrentUserUnavailableException.class)
	public ResponseEntity<ApiError> handleCurrentUserUnavailable(CurrentUserUnavailableException exception) {
		return error(HttpStatus.UNAUTHORIZED, "CURRENT_USER_UNAVAILABLE", exception.getMessage());
	}

	private ResponseEntity<ApiError> error(HttpStatus status, String code, String message) {
		return ResponseEntity.status(status)
				.body(new ApiError(code, message, Instant.now()));
	}

}
