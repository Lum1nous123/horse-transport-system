package com.horsetransport.horse;

import java.time.LocalDate;
import java.util.UUID;

public record HorseResponse(
		UUID id,
		String name,
		String passportNumber,
		String microchipId,
		String breed,
		String sex,
		LocalDate dateOfBirth,
		String notes) {

	static HorseResponse from(Horse horse) {
		return new HorseResponse(
				horse.getId(),
				horse.getName(),
				horse.getPassportNumber(),
				horse.getMicrochipId(),
				horse.getBreed(),
				horse.getSex(),
				horse.getDateOfBirth(),
				horse.getNotes());
	}

}
