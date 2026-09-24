package com.horsetransport.horse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

@ExtendWith(MockitoExtension.class)
class HorseServiceTest {

	private static final UUID CUSTOMER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

	@Mock
	private HorseRepository horseRepository;

	@Mock
	private CurrentUserProvider currentUserProvider;

	@InjectMocks
	private HorseService horseService;

	@Test
	void createsHorseForCurrentCustomer() {
		CreateHorseRequest request = request("985141000123456");
		when(currentUserProvider.getCurrentUserId()).thenReturn(CUSTOMER_ID);
		when(horseRepository.existsByMicrochipId(request.microchipId())).thenReturn(false);
		when(horseRepository.saveAndFlush(any(Horse.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		HorseResponse response = horseService.create(request);

		assertThat(response.id()).isNotNull();
		assertThat(response.name()).isEqualTo("Thunder");
		assertThat(response.microchipId()).isEqualTo("985141000123456");
		verify(horseRepository).saveAndFlush(any(Horse.class));
		verify(horseRepository).saveAndFlush(org.mockito.ArgumentMatchers.argThat(
				horse -> CUSTOMER_ID.equals(horse.getCustomerId())));
	}

	@Test
	void rejectsDuplicateMicrochipDuringPreCheck() {
		CreateHorseRequest request = request("985141000123456");
		when(currentUserProvider.getCurrentUserId()).thenReturn(CUSTOMER_ID);
		when(horseRepository.existsByMicrochipId(request.microchipId())).thenReturn(true);

		assertThatThrownBy(() -> horseService.create(request))
				.isInstanceOf(DuplicateMicrochipException.class);
		verify(horseRepository, never()).saveAndFlush(any(Horse.class));
	}

	@Test
	void translatesDatabaseMicrochipConstraintViolation() {
		CreateHorseRequest request = request("985141000123456");
		when(currentUserProvider.getCurrentUserId()).thenReturn(CUSTOMER_ID);
		when(horseRepository.existsByMicrochipId(request.microchipId())).thenReturn(false);
		when(horseRepository.saveAndFlush(any(Horse.class)))
				.thenThrow(new DataIntegrityViolationException("violates horses_microchip_id_key"));

		assertThatThrownBy(() -> horseService.create(request))
				.isInstanceOf(DuplicateMicrochipException.class)
				.hasMessage("A horse with this microchip ID already exists");
	}

	@Test
	void listsOnlyHorsesForCurrentCustomer() {
		Horse horse = new Horse(CUSTOMER_ID, "Thunder", null, "985141000123456",
				null, null, null, null);
		when(currentUserProvider.getCurrentUserId()).thenReturn(CUSTOMER_ID);
		when(horseRepository.findAllByCustomerId(CUSTOMER_ID)).thenReturn(List.of(horse));

		List<HorseResponse> responses = horseService.findCurrentCustomerHorses();

		assertThat(responses).hasSize(1);
		assertThat(responses.getFirst().id()).isEqualTo(horse.getId());
		verify(horseRepository).findAllByCustomerId(CUSTOMER_ID);
	}

	private CreateHorseRequest request(String microchipId) {
		return new CreateHorseRequest(
				"Thunder",
				"P-001",
				microchipId,
				"Thoroughbred",
				"MALE",
				LocalDate.of(2021, 4, 15),
				"Optional notes");
	}

}
