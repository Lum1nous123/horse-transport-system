package com.horsetransport.common.api;

import java.time.Instant;

import com.horsetransport.auth.DuplicateEmailException;
import com.horsetransport.auth.InvalidCredentialsException;
import com.horsetransport.horse.DuplicateMicrochipException;
import com.horsetransport.order.InvalidOrderHorsesException;
import com.horsetransport.order.InvalidOrderTransitionException;
import com.horsetransport.order.InvalidRejectionReasonException;
import com.horsetransport.order.OrderNotEditableException;
import com.horsetransport.order.OrderNotFoundException;
import com.horsetransport.order.OrderSubmissionValidationException;
import com.horsetransport.order.UnsupportedOrderInboxStatusException;
import com.horsetransport.payment.DepositPaymentConflictException;
import com.horsetransport.payment.DepositPaymentNotFoundException;
import com.horsetransport.payment.InvalidStripeWebhookException;
import com.horsetransport.payment.StripeConfigurationException;
import com.horsetransport.quotation.DuplicateQuotationException;
import com.horsetransport.quotation.QuotationNotEditableException;
import com.horsetransport.quotation.QuotationNotFoundException;
import com.horsetransport.quotation.QuotationValidationException;
import com.horsetransport.security.CurrentUserUnavailableException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(UnsupportedOrderInboxStatusException.class)
	public ResponseEntity<ApiError> handleUnsupportedOrderInboxStatus(
			UnsupportedOrderInboxStatusException exception) {
		return error(HttpStatus.BAD_REQUEST, "UNSUPPORTED_ORDER_INBOX_STATUS", exception.getMessage());
	}

	@ExceptionHandler(DepositPaymentNotFoundException.class)
	public ResponseEntity<ApiError> handleDepositPaymentNotFound(DepositPaymentNotFoundException exception) {
		return error(HttpStatus.NOT_FOUND, "DEPOSIT_PAYMENT_NOT_FOUND", exception.getMessage());
	}

	@ExceptionHandler(DepositPaymentConflictException.class)
	public ResponseEntity<ApiError> handleDepositPaymentConflict(DepositPaymentConflictException exception) {
		return error(HttpStatus.CONFLICT, "DEPOSIT_PAYMENT_CONFLICT", exception.getMessage());
	}

	@ExceptionHandler(InvalidStripeWebhookException.class)
	public ResponseEntity<ApiError> handleInvalidStripeWebhook(InvalidStripeWebhookException exception) {
		return error(HttpStatus.BAD_REQUEST, "INVALID_STRIPE_WEBHOOK", exception.getMessage());
	}

	@ExceptionHandler(StripeConfigurationException.class)
	public ResponseEntity<ApiError> handleStripeConfiguration(StripeConfigurationException exception) {
		return error(HttpStatus.SERVICE_UNAVAILABLE, "STRIPE_UNAVAILABLE", exception.getMessage());
	}

	@ExceptionHandler(QuotationNotFoundException.class)
	public ResponseEntity<ApiError> handleQuotationNotFound(QuotationNotFoundException exception) {
		return error(HttpStatus.NOT_FOUND, "QUOTATION_NOT_FOUND", exception.getMessage());
	}

	@ExceptionHandler(DuplicateQuotationException.class)
	public ResponseEntity<ApiError> handleDuplicateQuotation(DuplicateQuotationException exception) {
		return error(HttpStatus.CONFLICT, "DUPLICATE_QUOTATION", exception.getMessage());
	}

	@ExceptionHandler(QuotationNotEditableException.class)
	public ResponseEntity<ApiError> handleQuotationNotEditable(QuotationNotEditableException exception) {
		return error(HttpStatus.CONFLICT, "QUOTATION_NOT_EDITABLE", exception.getMessage());
	}

	@ExceptionHandler(QuotationValidationException.class)
	public ResponseEntity<ApiError> handleQuotationValidation(QuotationValidationException exception) {
		return error(HttpStatus.BAD_REQUEST, "QUOTATION_VALIDATION_ERROR", exception.getMessage());
	}

	@ExceptionHandler(InvalidOrderTransitionException.class)
	public ResponseEntity<ApiError> handleInvalidOrderTransition(InvalidOrderTransitionException exception) {
		return error(HttpStatus.CONFLICT, "INVALID_ORDER_TRANSITION", exception.getMessage());
	}

	@ExceptionHandler(OrderNotFoundException.class)
	public ResponseEntity<ApiError> handleOrderNotFound(OrderNotFoundException exception) {
		return error(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", exception.getMessage());
	}

	@ExceptionHandler(OrderNotEditableException.class)
	public ResponseEntity<ApiError> handleOrderNotEditable(OrderNotEditableException exception) {
		return error(HttpStatus.CONFLICT, "ORDER_NOT_EDITABLE", exception.getMessage());
	}

	@ExceptionHandler({InvalidOrderHorsesException.class, InvalidRejectionReasonException.class,
			OrderSubmissionValidationException.class})
	public ResponseEntity<ApiError> handleOrderBusinessValidation(RuntimeException exception) {
		return error(HttpStatus.BAD_REQUEST, "ORDER_VALIDATION_ERROR", exception.getMessage());
	}

	@ExceptionHandler(DuplicateMicrochipException.class)
	public ResponseEntity<ApiError> handleDuplicateMicrochip(DuplicateMicrochipException exception) {
		return error(HttpStatus.CONFLICT, "DUPLICATE_MICROCHIP", exception.getMessage());
	}

	@ExceptionHandler(DuplicateEmailException.class)
	public ResponseEntity<ApiError> handleDuplicateEmail(DuplicateEmailException exception) {
		return error(HttpStatus.CONFLICT, "DUPLICATE_EMAIL", exception.getMessage());
	}

	@ExceptionHandler(InvalidCredentialsException.class)
	public ResponseEntity<ApiError> handleInvalidCredentials(InvalidCredentialsException exception) {
		return error(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", exception.getMessage());
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
