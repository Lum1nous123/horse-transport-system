package com.horsetransport.security;

import com.horsetransport.auth.JwtAuthenticationFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration(proxyBeanMethods = false)
@EnableWebSecurity
public class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, JwtAuthenticationFilter jwtAuthenticationFilter)
			throws Exception {
		http
				.csrf(AbstractHttpConfigurer::disable)
				.cors(Customizer.withDefaults())
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.exceptionHandling(exceptions -> exceptions
						.authenticationEntryPoint((request, response, exception) ->
								response.setStatus(HttpStatus.UNAUTHORIZED.value()))
						.accessDeniedHandler((request, response, exception) ->
								response.setStatus(HttpStatus.FORBIDDEN.value())))
				.authorizeHttpRequests(authorize -> authorize
						.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
						.requestMatchers(HttpMethod.POST, "/api/v1/auth/register", "/api/v1/auth/login").permitAll()
						.requestMatchers(HttpMethod.POST, "/api/v1/payments/stripe/webhook").permitAll()
						.requestMatchers(HttpMethod.GET, "/api/v1/auth/me").authenticated()
						.requestMatchers("/api/v1/horses/**").hasRole("CUSTOMER")
						.requestMatchers(HttpMethod.GET, "/api/v1/orders/{orderId}/quotation")
								.hasAnyRole("CUSTOMER", "LOGISTICS_MANAGER")
						.requestMatchers(HttpMethod.POST, "/api/v1/orders/{orderId}/quotation",
								"/api/v1/orders/{orderId}/quotation/send")
								.hasRole("LOGISTICS_MANAGER")
						.requestMatchers(HttpMethod.PUT, "/api/v1/orders/{orderId}/quotation")
								.hasRole("LOGISTICS_MANAGER")
						.requestMatchers(HttpMethod.POST, "/api/v1/orders/{orderId}/reject")
								.hasRole("LOGISTICS_MANAGER")
						.requestMatchers(HttpMethod.GET, "/api/v1/orders/inbox")
								.hasRole("LOGISTICS_MANAGER")
						.requestMatchers(HttpMethod.GET, "/api/v1/orders/{orderId}")
								.hasAnyRole("CUSTOMER", "LOGISTICS_MANAGER")
						.requestMatchers("/api/v1/orders/**").hasRole("CUSTOMER")
						.requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
						.anyRequest().denyAll())
				.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

		return http.build();
	}

	@Bean
	PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}

	@Bean
	FilterRegistrationBean<JwtAuthenticationFilter> disableJwtFilterAutoRegistration(
			JwtAuthenticationFilter jwtAuthenticationFilter) {
		FilterRegistrationBean<JwtAuthenticationFilter> registration =
				new FilterRegistrationBean<>(jwtAuthenticationFilter);
		registration.setEnabled(false);
		return registration;
	}
}
