package com.horsetransport.config;

import java.util.List;

import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import com.horsetransport.user.UserStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

public class Sprint3DemoAccountSeeder {

	static final List<DemoAccount> ACCOUNTS = List.of(
			new DemoAccount("Sprint 3 Logistics Manager", "lm.s3demo@example.com", UserRole.LOGISTICS_MANAGER),
			new DemoAccount("Sprint 3 Driver One", "driver1.s3demo@example.com", UserRole.DRIVER),
			new DemoAccount("Sprint 3 Driver Two", "driver2.s3demo@example.com", UserRole.DRIVER),
			new DemoAccount("Sprint 3 Escort One", "escort1.s3demo@example.com", UserRole.ESCORT),
			new DemoAccount("Sprint 3 Escort Two", "escort2.s3demo@example.com", UserRole.ESCORT),
			new DemoAccount("Sprint 3 Customer", "customer.s3demo@example.com", UserRole.CUSTOMER),
			new DemoAccount("Sprint 3 Transport Specialist", "ts.s3demo@example.com", UserRole.TRANSPORT_SPECIALIST),
			new DemoAccount("Sprint 3 Fleet Route Coordinator", "frc.s3demo@example.com", UserRole.FLEET_ROUTE_COORDINATOR));

	private final UserRepository users;
	private final PasswordEncoder passwordEncoder;

	public Sprint3DemoAccountSeeder(UserRepository users, PasswordEncoder passwordEncoder) {
		this.users = users;
		this.passwordEncoder = passwordEncoder;
	}

	@Transactional
	public SeedResult seed(String password) {
		if (password == null || password.isBlank()) throw new IllegalArgumentException("Demo password is required");
		int created = 0;
		int existing = 0;
		for (DemoAccount expected : ACCOUNTS) {
			UserAccount account = users.findByEmailIgnoreCase(expected.email()).orElse(null);
			if (account == null) {
				users.save(UserAccount.createActive(expected.name(), expected.email(), null,
						passwordEncoder.encode(password), expected.role()));
				created++;
			} else {
				boolean matches = account.getFullName().equals(expected.name())
						&& account.getRole() == expected.role()
						&& account.getStatus() == UserStatus.ACTIVE
						&& passwordEncoder.matches(password, account.getPasswordHash());
				if (!matches) throw new DemoStaffSeedConflictException(
						"Existing account conflicts with Sprint 3 demo namespace: " + expected.email());
				existing++;
			}
		}
		users.flush();
		return new SeedResult(created, existing);
	}

	record DemoAccount(String name, String email, UserRole role) { }
	public record SeedResult(int created, int existing) { }
}
