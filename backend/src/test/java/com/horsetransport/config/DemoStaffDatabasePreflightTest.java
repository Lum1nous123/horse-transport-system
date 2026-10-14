package com.horsetransport.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;

import javax.sql.DataSource;

import org.junit.jupiter.api.Test;

class DemoStaffDatabasePreflightTest {

	@Test
	void verifiesHostDatabaseSchemaAndReadOnlyTransactionThenRollsBack() throws Exception {
		Fixture fixture = fixture("approved.example.test", "approved_db", "public", "on");

		DemoStaffDatabasePreflight.DatabaseIdentity identity = fixture.preflight.verify(
				new DemoStaffSeedSafety.ApprovedDatabaseTarget("approved.example.test", "approved_db", "public"));

		assertThat(identity.database()).isEqualTo("approved_db");
		verify(fixture.connection).setReadOnly(true);
		verify(fixture.connection).setAutoCommit(false);
		verify(fixture.readOnlyStatement).execute("set transaction read only");
		verify(fixture.connection).rollback();
	}

	@Test
	void failsClosedForWrongHostSchemaOrReadWriteTransaction() throws Exception {
		Fixture wrongHost = fixture("wrong.example.test", "approved_db", "public", "on");
		assertThatThrownBy(() -> wrongHost.preflight.verify(
				new DemoStaffSeedSafety.ApprovedDatabaseTarget("approved.example.test", "approved_db", "public")))
				.isInstanceOf(DemoStaffSeedSafetyException.class);

		Fixture wrongSchema = fixture("approved.example.test", "approved_db", "private", "on");
		assertThatThrownBy(() -> wrongSchema.preflight.verify(
				new DemoStaffSeedSafety.ApprovedDatabaseTarget("approved.example.test", "approved_db", "public")))
				.isInstanceOf(DemoStaffSeedSafetyException.class);

		Fixture readWrite = fixture("approved.example.test", "approved_db", "public", "off");
		assertThatThrownBy(() -> readWrite.preflight.verify(
				new DemoStaffSeedSafety.ApprovedDatabaseTarget("approved.example.test", "approved_db", "public")))
				.isInstanceOf(DemoStaffSeedSafetyException.class);
	}

	private Fixture fixture(String host, String database, String schema, String transactionReadOnly) throws Exception {
		DataSource dataSource = mock(DataSource.class);
		Connection connection = mock(Connection.class);
		DatabaseMetaData metadata = mock(DatabaseMetaData.class);
		Statement readOnlyStatement = mock(Statement.class);
		PreparedStatement identityStatement = mock(PreparedStatement.class);
		ResultSet result = mock(ResultSet.class);
		when(dataSource.getConnection()).thenReturn(connection);
		when(connection.getMetaData()).thenReturn(metadata);
		when(metadata.getURL()).thenReturn("jdbc:postgresql://" + host + ":5432/" + database + "?sslmode=require");
		when(connection.createStatement()).thenReturn(readOnlyStatement);
		when(connection.prepareStatement(
				"select current_database(), current_schema(), current_setting('transaction_read_only')"))
				.thenReturn(identityStatement);
		when(identityStatement.executeQuery()).thenReturn(result);
		when(result.next()).thenReturn(true);
		when(result.getString(1)).thenReturn(database);
		when(result.getString(2)).thenReturn(schema);
		when(result.getString(3)).thenReturn(transactionReadOnly);
		return new Fixture(new DemoStaffDatabasePreflight(dataSource), connection, readOnlyStatement);
	}

	private record Fixture(DemoStaffDatabasePreflight preflight, Connection connection,
			Statement readOnlyStatement) {
	}
}
