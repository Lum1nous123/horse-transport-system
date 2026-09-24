package com.horsetransport.auth;

public record LoginResponse(String accessToken, String tokenType, long expiresInSeconds) {
}
