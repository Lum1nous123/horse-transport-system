package com.horsetransport.config;

import java.util.List;

import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import com.horsetransport.user.UserStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DemoStaffSeeder {

	static final List<DemoStaffAccount> DEMO_STAFF = List.of(
			new DemoStaffAccount("Alex Carter", "alex.carter.ts@demo.horsetransport.local",
					UserRole.TRANSPORT_SPECIALIST),
			new DemoStaffAccount("Brooke Mitchell", "brooke.mitchell.ts@demo.horsetransport.local",
					UserRole.TRANSPORT_SPECIALIST),
			new DemoStaffAccount("Daniel Kim", "daniel.kim.ts@demo.horsetransport.local",
					UserRole.TRANSPORT_SPECIALIST),
			new DemoStaffAccount("Emily Ross", "emily.ross.ts@demo.horsetransport.local",
					UserRole.TRANSPORT_SPECIALIST),
			new DemoStaffAccount("Jordan Ellis", "jordan.ellis.frc@demo.horsetransport.local",
					UserRole.FLEET_ROUTE_COORDINATOR),
			new DemoStaffAccount("Taylor Nguyen", "taylor.nguyen.frc@demo.horsetransport.local",
					UserRole.FLEET_ROUTE_COORDINATOR),
			new DemoStaffAccount("Riley Thomas", "riley.thomas.frc@demo.horsetransport.local",
					UserRole.FLEET_ROUTE_COORDINATOR),
			new DemoStaffAccount("Avery Wilson", "avery.wilson.frc@demo.horsetransport.local",
					UserRole.FLEET_ROUTE_COORDINATOR));

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;

	public DemoStaffSeeder(UserRepository userRepository, PasswordEncoder passwordEncoder) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
	}

	@Transactional
	public DemoStaffSeedResult seed(String sharedPassword) {
		if (sharedPassword == null || sharedPassword.isBlank()) {
			throw new IllegalArgumentException("HTS_DEMO_STAFF_PASSWORD must be set and non-blank");
		}

		int created = 0;
		int existing = 0;
		for (DemoStaffAccount expected : DEMO_STAFF) {
			UserAccount account = userRepository.findByEmailIgnoreCase(expected.email()).orElse(null);
			if (account == null) {
				userRepository.save(UserAccount.createActive(expected.fullName(), expected.email(), null,
						passwordEncoder.encode(sharedPassword), expected.role()));
				created++;
				continue;
			}
			validateExisting(account, expected, sharedPassword);
			existing++;
		}
		userRepository.flush();
		return new DemoStaffSeedResult(created, existing);
	}

	private void validateExisting(UserAccount account, DemoStaffAccount expected, String sharedPassword) {
		boolean matches = account.getFullName().equals(expected.fullName())
				&& account.getRole() == expected.role()
				&& account.getStatus() == UserStatus.ACTIVE
				&& passwordEncoder.matches(sharedPassword, account.getPasswordHash());
		if (!matches) {
			throw new DemoStaffSeedConflictException(
					"Existing account conflicts with the reviewed demo staff definition: " + expected.email());
		}
	}

	static record DemoStaffAccount(String fullName, String email, UserRole role) {
	}

	public record DemoStaffSeedResult(int created, int existing) {
	}
}
