package com.horsetransport.config;

import java.util.List;

import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.horsetransport.route.Vehicle;
import com.horsetransport.route.VehicleRepository;
import com.horsetransport.route.VehicleStatus;

@Component
@Profile("local")
@ConditionalOnProperty(name = "hts.local-development-seed.enabled", havingValue = "true")
public class LocalDevelopmentDataSeeder implements ApplicationRunner {

	private static final List<SeedUser> USERS = List.of(
			new SeedUser("Sprint Customer", "customer@test.local", UserRole.CUSTOMER),
			new SeedUser("Sprint Logistics Manager", "lm@test.local", UserRole.LOGISTICS_MANAGER),
			new SeedUser("Sprint Transport Specialist", "ts@test.local", UserRole.TRANSPORT_SPECIALIST),
			new SeedUser("Sprint Route Coordinator", "route@test.local", UserRole.FLEET_ROUTE_COORDINATOR),
			new SeedUser("Sprint Driver", "driver@test.local", UserRole.DRIVER),
			new SeedUser("Sprint Escort", "escort@test.local", UserRole.ESCORT)
	);

	private static final List<SeedVehicle> VEHICLES = List.of(
			new SeedVehicle("HTS-ROAD-001", "Local Road Trailer 1", "2-horse road trailer", 2),
			new SeedVehicle("HTS-ROAD-002", "Local Road Trailer 2", "3-horse road trailer", 3),
			new SeedVehicle("HTS-ROAD-003", "Long Haul Horsebox", "4-horse road vehicle", 4));

	private final UserRepository userRepository;
	private final VehicleRepository vehicleRepository;
	private final PasswordEncoder passwordEncoder;
	private final String developmentPassword;

	public LocalDevelopmentDataSeeder(UserRepository userRepository, VehicleRepository vehicleRepository,
			PasswordEncoder passwordEncoder,
			@Value("${hts.local-development-seed.password:}") String developmentPassword) {
		this.userRepository = userRepository;
		this.vehicleRepository = vehicleRepository;
		this.passwordEncoder = passwordEncoder;
		this.developmentPassword = developmentPassword;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments arguments) {
		if (developmentPassword == null || developmentPassword.isBlank()) {
			throw new IllegalArgumentException("HTS_LOCAL_DEVELOPMENT_SEED_PASSWORD must be set and non-blank");
		}
		for (SeedUser seedUser : USERS) {
			if (userRepository.existsByEmailIgnoreCase(seedUser.email())) {
				continue;
			}
			userRepository.save(UserAccount.createActive(seedUser.fullName(), seedUser.email(), null,
					passwordEncoder.encode(developmentPassword), seedUser.role()));
		}

		for (SeedVehicle seedVehicle : VEHICLES) {
			if (vehicleRepository.findByPlateNumber(seedVehicle.plateNumber()).isPresent()) {
				continue;
			}
			vehicleRepository.save(new Vehicle(seedVehicle.plateNumber(), seedVehicle.vehicleName(),
					seedVehicle.vehicleType(), seedVehicle.horseCapacity(), VehicleStatus.AVAILABLE, null));
		}

		userRepository.flush();
		vehicleRepository.flush();
	}

	private record SeedUser(String fullName, String email, UserRole role) {
	}

	private record SeedVehicle(String plateNumber, String vehicleName, String vehicleType, int horseCapacity) {
	}
}
