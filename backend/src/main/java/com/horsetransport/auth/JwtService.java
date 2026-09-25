package com.horsetransport.auth;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRole;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

	private final Algorithm algorithm;
	private final JWTVerifier verifier;
	private final String issuer;
	private final long expirationMinutes;

	public JwtService(
			@Value("${app.security.jwt.secret}") String secret,
			@Value("${app.security.jwt.issuer:horse-transport-system}") String issuer,
			@Value("${app.security.jwt.expiration-minutes:60}") long expirationMinutes) {
		if (secret.getBytes(StandardCharsets.UTF_8).length < 32) {
			throw new IllegalArgumentException("JWT secret must contain at least 32 bytes");
		}
		if (expirationMinutes <= 0) {
			throw new IllegalArgumentException("JWT expiration must be positive");
		}
		this.algorithm = Algorithm.HMAC256(secret);
		this.issuer = issuer;
		this.expirationMinutes = expirationMinutes;
		this.verifier = JWT.require(algorithm)
				.withIssuer(issuer)
				.withClaimPresence("sub")
				.withClaimPresence("role")
				.withClaimPresence("iat")
				.withClaimPresence("exp")
				.build();
	}

	public String createToken(UserAccount user) {
		Instant issuedAt = Instant.now();
		return JWT.create()
				.withIssuer(issuer)
				.withSubject(user.getId().toString())
				.withClaim("role", user.getRole().name())
				.withIssuedAt(issuedAt)
				.withExpiresAt(issuedAt.plus(expirationMinutes, ChronoUnit.MINUTES))
				.sign(algorithm);
	}

	public VerifiedJwt verify(String token) {
		DecodedJWT jwt = verifier.verify(token);
		return new VerifiedJwt(
				UUID.fromString(jwt.getSubject()),
				UserRole.valueOf(jwt.getClaim("role").asString()));
	}

	public long getExpirationSeconds() {
		return expirationMinutes * 60;
	}

	public record VerifiedJwt(UUID userId, UserRole role) {
	}
}
