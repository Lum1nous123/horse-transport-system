package com.horsetransport.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

class DemoStaffSeederTest {

	private final UserRepository userRepository = mock(UserRepository.class);
	private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
	private final DemoStaffSeeder seeder = new DemoStaffSeeder(userRepository, passwordEncoder);
	private final String sharedPassword = "generated-" + UUID.randomUUID();

	@Test
	void createsFourTransportSpecialistsAndFourFleetRouteCoordinatorsWithEncodedPassword() {
		Map<String, UserAccount> stored = repositoryBackedByMap();

		DemoStaffSeeder.DemoStaffSeedResult result = seeder.seed(sharedPassword);

		assertThat(result.created()).isEqualTo(8);
		assertThat(result.existing()).isZero();
		assertThat(stored.values()).hasSize(8);
		assertThat(stored.values()).filteredOn(account -> account.getRole() == UserRole.TRANSPORT_SPECIALIST)
				.hasSize(4);
		assertThat(stored.values()).filteredOn(account -> account.getRole() == UserRole.FLEET_ROUTE_COORDINATOR)
				.hasSize(4);
		assertThat(stored.values()).allSatisfy(account -> {
			assertThat(passwordEncoder.matches(sharedPassword, account.getPasswordHash())).isTrue();
			assertThat(account.getPasswordHash()).doesNotContain(sharedPassword);
		});
	}

	@Test
	void secondRunIsIdempotentAndDoesNotResetExistingPasswords() {
		Map<String, UserAccount> stored = repositoryBackedByMap();
		seeder.seed(sharedPassword);

		DemoStaffSeeder.DemoStaffSeedResult secondRun = seeder.seed(sharedPassword);

		assertThat(secondRun.created()).isZero();
		assertThat(secondRun.existing()).isEqualTo(8);
		assertThat(stored).hasSize(8);
		verify(userRepository, org.mockito.Mockito.times(8)).save(any(UserAccount.class));
	}

	@Test
	void conflictingExistingEmailStopsWithoutOverwritingTheAccount() {
		DemoStaffSeeder.DemoStaffAccount expected = DemoStaffSeeder.DEMO_STAFF.getFirst();
		UserAccount conflicting = UserAccount.createActive("Different Name", expected.email(), null,
				passwordEncoder.encode(sharedPassword), UserRole.FLEET_ROUTE_COORDINATOR);
		when(userRepository.findByEmailIgnoreCase(expected.email())).thenReturn(Optional.of(conflicting));

		assertThatThrownBy(() -> seeder.seed(sharedPassword))
				.isInstanceOf(DemoStaffSeedConflictException.class)
				.hasMessageContaining(expected.email());
		verify(userRepository, never()).save(any(UserAccount.class));
	}

	private Map<String, UserAccount> repositoryBackedByMap() {
		Map<String, UserAccount> stored = new LinkedHashMap<>();
		when(userRepository.findByEmailIgnoreCase(any())).thenAnswer(invocation ->
				Optional.ofNullable(stored.get(invocation.getArgument(0, String.class).toLowerCase())));
		when(userRepository.save(any(UserAccount.class))).thenAnswer(invocation -> {
			UserAccount account = invocation.getArgument(0);
			stored.put(account.getEmail().toLowerCase(), account);
			return account;
		});
		return stored;
	}
}
