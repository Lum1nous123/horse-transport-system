package com.horsetransport.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;

import org.junit.jupiter.api.Test;
import org.flywaydb.database.postgresql.PostgreSQLConfigurationExtension;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.env.MockEnvironment;

class DatasourceConnectionConfigurationTest {

	@Test
	void requiresTlsAndDisablesGssNegotiationForSupabasePooler() throws IOException {
		var applicationProperties = new YamlPropertySourceLoader()
				.load("application", new ClassPathResource("application.yaml"));
		var environment = new MockEnvironment()
				.withProperty("DB_HOST", "pooler.example.test")
				.withProperty("DB_PORT", "5432")
				.withProperty("DB_NAME", "postgres");
		applicationProperties.forEach(environment.getPropertySources()::addLast);

		assertThat(environment.getProperty("spring.datasource.url"))
				.isEqualTo("jdbc:postgresql://pooler.example.test:5432/postgres"
						+ "?sslmode=require&gssEncMode=disable&prepareThreshold=0");
	}

	@Test
	void resolvesTransactionPoolerPortAndPreparedStatementSettingFromEnvironment() throws IOException {
		var applicationProperties = new YamlPropertySourceLoader()
				.load("application", new ClassPathResource("application.yaml"));
		var environment = new MockEnvironment()
				.withProperty("DB_HOST", "pooler.example.test")
				.withProperty("DB_PORT", "6543")
				.withProperty("DB_NAME", "postgres")
				.withProperty("DB_PREPARE_THRESHOLD", "0");
		applicationProperties.forEach(environment.getPropertySources()::addLast);

		assertThat(environment.getProperty("spring.datasource.url"))
				.isEqualTo("jdbc:postgresql://pooler.example.test:6543/postgres"
						+ "?sslmode=require&gssEncMode=disable&prepareThreshold=0");
	}

	@Test
	void flywayPostgresqlLockIsTransactionalByDefault() {
		assertThat(new PostgreSQLConfigurationExtension().isTransactionalLock()).isTrue();
	}
}
