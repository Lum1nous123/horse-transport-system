package com.horsetransport.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRole;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

	private static final String SECRET = "01234567890123456789012345678901";
	private static final String ISSUER = "horse-transport-system";

	private final JwtService jwtService = new JwtService(SECRET, ISSUER, 60);

	@Test
	void createsAndVerifiesRequiredClaims() {
		UserAccount user = UserAccount.registerCustomer(
				"Customer One", "customer@example.com", null, "password-hash");

		JwtService.VerifiedJwt verified = jwtService.verify(jwtService.createToken(user));

		assertThat(verified.userId()).isEqualTo(user.getId());
		assertThat(verified.role()).isEqualTo(UserRole.CUSTOMER);
	}

	@Test
	void rejectsInvalidToken() {
		assertThatThrownBy(() -> jwtService.verify("not-a-jwt"))
				.isInstanceOf(JWTVerificationException.class);
	}

	@Test
	void rejectsExpiredToken() {
		Instant past = Instant.now().minus(2, ChronoUnit.HOURS);
		String expiredToken = JWT.create()
				.withIssuer(ISSUER)
				.withSubject("11111111-1111-1111-1111-111111111111")
				.withClaim("role", UserRole.CUSTOMER.name())
				.withIssuedAt(past)
				.withExpiresAt(past.plus(1, ChronoUnit.HOURS))
				.sign(Algorithm.HMAC256(SECRET));

		assertThatThrownBy(() -> jwtService.verify(expiredToken))
				.isInstanceOf(JWTVerificationException.class);
	}
}
