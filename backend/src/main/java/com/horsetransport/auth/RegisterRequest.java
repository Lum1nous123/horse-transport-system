package com.horsetransport.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
		@NotBlank(message = "fullName is required")
		@Size(max = 120, message = "fullName must not exceed 120 characters")
		String fullName,

		@NotBlank(message = "email is required")
		@Email(message = "email must be valid")
		@Size(max = 150, message = "email must not exceed 150 characters")
		String email,

		@Size(max = 30, message = "phone must not exceed 30 characters")
		String phone,

		@NotBlank(message = "password is required")
		@Size(min = 8, max = 72, message = "password must contain between 8 and 72 characters")
		String password) {
}
