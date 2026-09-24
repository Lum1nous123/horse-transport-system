package com.horsetransport.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration(proxyBeanMethods = false)
@Profile("local")
public class LocalCorsConfig implements WebMvcConfigurer {

	private static final String LOCAL_FRONTEND_ORIGIN = "http://localhost:3000";

	@Override
	public void addCorsMappings(CorsRegistry registry) {
		registry.addMapping("/**")
				.allowedOrigins(LOCAL_FRONTEND_ORIGIN)
				.allowedMethods("GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
				.allowedHeaders("Accept", "Authorization", "Content-Type", "Origin", "X-Current-User-Id",
						"X-Requested-With")
				.maxAge(3600);
	}

}
