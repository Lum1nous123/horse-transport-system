package com.horsetransport.document;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class CloudinaryConfig {

	@Bean
	Cloudinary cloudinary(@Value("${app.storage.cloudinary.cloud-name:}") String cloudName,
			@Value("${app.storage.cloudinary.api-key:}") String apiKey,
			@Value("${app.storage.cloudinary.api-secret:}") String apiSecret) {
		return new Cloudinary(ObjectUtils.asMap(
				"cloud_name", cloudName,
				"api_key", apiKey,
				"api_secret", apiSecret,
				"secure", true));
	}
}
