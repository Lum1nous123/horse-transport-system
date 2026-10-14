package com.horsetransport.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.horsetransport.route.Vehicle;
import com.horsetransport.route.VehicleRepository;
import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import com.horsetransport.user.UserStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class LocalDevelopmentDataSeederTest {
	private final String developmentPassword = "generated-" + UUID.randomUUID();

	@Mock private UserRepository userRepository;
	@Mock private VehicleRepository vehicleRepository;

	private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

	@Test
	void isRestrictedToLocalProfile() {
		Profile profile = LocalDevelopmentDataSeeder.class.getAnnotation(Profile.class);

		assertThat(profile).isNotNull();
		assertThat(profile.value()).containsExactly("local");
	}

	@Test
	void createsOneActiveAccountForEverySupportedRoleWithEncodedPassword() {
		when(userRepository.existsByEmailIgnoreCase(any())).thenReturn(false);
		when(vehicleRepository.findByPlateNumber(any())).thenReturn(Optional.empty());
		LocalDevelopmentDataSeeder seeder = new LocalDevelopmentDataSeeder(
				userRepository, vehicleRepository, passwordEncoder, developmentPassword);

		seeder.run(null);

		ArgumentCaptor<UserAccount> accounts = ArgumentCaptor.forClass(UserAccount.class);
		verify(userRepository, org.mockito.Mockito.times(6)).save(accounts.capture());
		verify(userRepository).flush();

		List<UserAccount> created = accounts.getAllValues();
		assertThat(created).extracting(UserAccount::getEmail).containsExactly(
				"customer@test.local", "lm@test.local", "ts@test.local", "route@test.local",
				"driver@test.local", "escort@test.local");
		assertThat(created).extracting(UserAccount::getRole).containsExactly(UserRole.values());
		assertThat(created).allSatisfy(account -> {
			assertThat(account.getStatus()).isEqualTo(UserStatus.ACTIVE);
			assertThat(passwordEncoder.matches(developmentPassword,
					account.getPasswordHash())).isTrue();
			assertThat(account.getPasswordHash()).doesNotContain(developmentPassword);
		});

		ArgumentCaptor<Vehicle> vehicles = ArgumentCaptor.forClass(Vehicle.class);
		verify(vehicleRepository, org.mockito.Mockito.times(3)).save(vehicles.capture());
		verify(vehicleRepository).flush();

		assertThat(vehicles.getAllValues())
				.extracting(Vehicle::getPlateNumber)
				.containsExactly("HTS-ROAD-001", "HTS-ROAD-002", "HTS-ROAD-003");
	}

	@Test
	void existingEmailsAreNotOverwrittenOrDuplicated() {
		when(userRepository.existsByEmailIgnoreCase(any())).thenReturn(true);
		when(vehicleRepository.findByPlateNumber(any())).thenReturn(Optional.empty());
		LocalDevelopmentDataSeeder seeder = new LocalDevelopmentDataSeeder(
				userRepository, vehicleRepository, passwordEncoder, developmentPassword);

		seeder.run(null);

		verify(userRepository, never()).save(any());
		verify(userRepository).flush();
		verify(vehicleRepository, org.mockito.Mockito.times(3)).save(any());
		verify(vehicleRepository).flush();
	}
}
