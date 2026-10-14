package com.horsetransport.config;

import java.net.URI;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

import javax.sql.DataSource;

public class DemoStaffDatabasePreflight {

	private final DataSource dataSource;

	public DemoStaffDatabasePreflight(DataSource dataSource) {
		this.dataSource = dataSource;
	}

	public DatabaseIdentity verify(DemoStaffSeedSafety.ApprovedDatabaseTarget approved) {
		try (Connection connection = dataSource.getConnection()) {
			connection.setReadOnly(true);
			connection.setAutoCommit(false);
			try {
				assertConnectedHost(connection, approved.host());
				try (Statement readOnly = connection.createStatement()) {
					readOnly.execute("set transaction read only");
				}
				try (PreparedStatement statement = connection.prepareStatement(
						"select current_database(), current_schema(), current_setting('transaction_read_only')")) {
					try (ResultSet result = statement.executeQuery()) {
						if (!result.next()) {
							throw new DemoStaffSeedSafetyException("Database identity query returned no result");
						}
						DatabaseIdentity identity = new DatabaseIdentity(
								result.getString(1), result.getString(2), result.getString(3));
						if (!identity.database().equals(approved.database())
								|| !identity.schema().equals(approved.schema())
								|| !"on".equalsIgnoreCase(identity.transactionReadOnly())) {
							throw new DemoStaffSeedSafetyException(
									"Connected database identity/read-only state does not match the approved target");
						}
						return identity;
					}
				}
			}
			finally {
				connection.rollback();
			}
		}
		catch (SQLException | IllegalArgumentException exception) {
			throw new DemoStaffSeedSafetyException("Database preflight could not verify the approved target");
		}
	}

	private void assertConnectedHost(Connection connection, String expectedHost) throws SQLException {
		String jdbcUrl = connection.getMetaData().getURL();
		if (jdbcUrl == null || !jdbcUrl.startsWith("jdbc:postgresql://")) {
			throw new DemoStaffSeedSafetyException("Connected datasource is not PostgreSQL");
		}
		URI uri = URI.create(jdbcUrl.substring("jdbc:".length()));
		if (uri.getHost() == null || !uri.getHost().equalsIgnoreCase(expectedHost)) {
			throw new DemoStaffSeedSafetyException("Connected database host does not match the approved target");
		}
	}

	public record DatabaseIdentity(String database, String schema, String transactionReadOnly) {
	}
}
