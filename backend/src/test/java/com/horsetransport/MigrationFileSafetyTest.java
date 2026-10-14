package com.horsetransport;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.BufferedReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.zip.CRC32;

import org.junit.jupiter.api.Test;

class MigrationFileSafetyTest {

	@Test
	void migrationChainMatchesTheProductionCanonicalHistory() throws Exception {
		Path migrations = Path.of("src/main/resources/db/migration");
		Path v1 = migrations.resolve("V1__initial_schema.sql");
		Path v2 = migrations.resolve("V2__deposit_refund_retries.sql");
		Path v3 = migrations.resolve("V3__add_frc_eligible_to_transport_orders.sql");
		Path v5 = migrations.resolve("V5__add_transport_order_code_sequence.sql");

		try (var files = Files.list(migrations)) {
			assertThat(files.map(path -> path.getFileName().toString()).sorted().toList())
					.containsExactly(
							"V1__initial_schema.sql",
							"V2__deposit_refund_retries.sql",
							"V3__add_frc_eligible_to_transport_orders.sql",
							"V5__add_transport_order_code_sequence.sql");
		}

		assertThat(flywayChecksum(v1)).isEqualTo(-1027814250);
		assertThat(flywayChecksum(v2)).isEqualTo(1542157360);
		assertThat(Files.readString(v3)).isEmpty();
		assertThat(flywayChecksum(v3)).isZero();
		assertThat(flywayChecksum(v5)).isEqualTo(125409323);
	}

	@Test
	void v2DepositRefundMigrationMatchesTheAppliedProductionSql() throws Exception {
		Path v2 = Path.of("src/main/resources/db/migration/V2__deposit_refund_retries.sql");

		assertThat(Files.readAllLines(v2)).containsExactlyElementsOf(List.of(
				"ALTER TABLE deposit_refunds",
				"    ADD COLUMN retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),",
				"    ADD COLUMN next_attempt_at timestamp;",
				"",
				"CREATE INDEX idx_deposit_refunds_retryable",
				"    ON deposit_refunds (next_attempt_at)",
				"    WHERE completed_at IS NULL;"));
	}

	private int flywayChecksum(Path migration) throws Exception {
		CRC32 crc32 = new CRC32();
		try (BufferedReader reader = Files.newBufferedReader(migration, StandardCharsets.UTF_8)) {
			String line;
			while ((line = reader.readLine()) != null) {
				crc32.update(line.getBytes(StandardCharsets.UTF_8));
			}
		}
		return (int) crc32.getValue();
	}
}
