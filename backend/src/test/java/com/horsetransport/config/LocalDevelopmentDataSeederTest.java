package com.horsetransport.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

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

	@Mock private UserRepository userRepository;
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
		LocalDevelopmentDataSeeder seeder = new LocalDevelopmentDataSeeder(userRepository, passwordEncoder);

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
			assertThat(passwordEncoder.matches(LocalDevelopmentDataSeeder.DEVELOPMENT_PASSWORD,
					account.getPasswordHash())).isTrue();
			assertThat(account.getPasswordHash()).doesNotContain(LocalDevelopmentDataSeeder.DEVELOPMENT_PASSWORD);
		});
	}

	@Test
	void existingEmailsAreNotOverwrittenOrDuplicated() {
		when(userRepository.existsByEmailIgnoreCase(any())).thenReturn(true);
		LocalDevelopmentDataSeeder seeder = new LocalDevelopmentDataSeeder(userRepository, passwordEncoder);

		seeder.run(null);

		verify(userRepository, never()).save(any());
		verify(userRepository).flush();
	}
}
