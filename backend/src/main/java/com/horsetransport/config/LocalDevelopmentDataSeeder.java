package com.horsetransport.config;

import java.util.List;

import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("local")
public class LocalDevelopmentDataSeeder implements ApplicationRunner {

	static final String DEVELOPMENT_PASSWORD = "Test1234!";

	private static final List<SeedUser> USERS = List.of(
			new SeedUser("Sprint Customer", "customer@test.local", UserRole.CUSTOMER),
			new SeedUser("Sprint Logistics Manager", "lm@test.local", UserRole.LOGISTICS_MANAGER),
			new SeedUser("Sprint Transport Specialist", "ts@test.local", UserRole.TRANSPORT_SPECIALIST),
			new SeedUser("Sprint Route Coordinator", "route@test.local", UserRole.FLEET_ROUTE_COORDINATOR),
			new SeedUser("Sprint Driver", "driver@test.local", UserRole.DRIVER),
			new SeedUser("Sprint Escort", "escort@test.local", UserRole.ESCORT));

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;

	public LocalDevelopmentDataSeeder(UserRepository userRepository, PasswordEncoder passwordEncoder) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments arguments) {
		for (SeedUser seedUser : USERS) {
			if (userRepository.existsByEmailIgnoreCase(seedUser.email())) continue;
			userRepository.save(UserAccount.createActive(seedUser.fullName(), seedUser.email(), null,
					passwordEncoder.encode(DEVELOPMENT_PASSWORD), seedUser.role()));
		}
		userRepository.flush();
	}

	private record SeedUser(String fullName, String email, UserRole role) {
	}
}
