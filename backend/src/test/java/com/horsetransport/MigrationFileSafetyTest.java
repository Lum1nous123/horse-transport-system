package com.horsetransport;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class MigrationFileSafetyTest {

	@Test
	void v3MigrationRemainsEmptyToAvoidChangingExistingFlywayChecksum() throws Exception {
		Path v3 = Path.of("src/main/resources/db/migration/V3__add_frc_eligible_to_transport_orders.sql");

		assertThat(Files.readString(v3)).isEmpty();
	}
}
