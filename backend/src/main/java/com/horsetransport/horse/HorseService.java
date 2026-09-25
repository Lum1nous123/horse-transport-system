package com.horsetransport.horse;

import java.util.List;
import java.util.UUID;

import com.horsetransport.security.CurrentUserProvider;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class HorseService {

	private static final String MICROCHIP_UNIQUE_CONSTRAINT = "horses_microchip_id_key";

	private final HorseRepository horseRepository;
	private final CurrentUserProvider currentUserProvider;

	public HorseService(HorseRepository horseRepository, CurrentUserProvider currentUserProvider) {
		this.horseRepository = horseRepository;
		this.currentUserProvider = currentUserProvider;
	}

	@Transactional
	public HorseResponse create(CreateHorseRequest request) {
		UUID customerId = currentUserProvider.getCurrentUserId();
		if (horseRepository.existsByMicrochipId(request.microchipId())) {
			throw new DuplicateMicrochipException();
		}

		Horse horse = new Horse(
				customerId,
				request.name(),
				request.passportNumber(),
				request.microchipId(),
				request.breed(),
				request.sex(),
				request.dateOfBirth(),
				request.notes());

		try {
			return HorseResponse.from(horseRepository.saveAndFlush(horse));
		} catch (DataIntegrityViolationException exception) {
			if (isMicrochipUniqueViolation(exception)) {
				throw new DuplicateMicrochipException();
			}
			throw exception;
		}
	}

	@Transactional(readOnly = true)
	public List<HorseResponse> findCurrentCustomerHorses() {
		UUID customerId = currentUserProvider.getCurrentUserId();
		return horseRepository.findAllByCustomerId(customerId).stream()
				.map(HorseResponse::from)
				.toList();
	}

	private boolean isMicrochipUniqueViolation(DataIntegrityViolationException exception) {
		Throwable cause = exception;
		while (cause != null) {
			if (cause instanceof ConstraintViolationException constraintViolation
					&& MICROCHIP_UNIQUE_CONSTRAINT.equals(constraintViolation.getConstraintName())) {
				return true;
			}
			if (cause.getMessage() != null && cause.getMessage().contains(MICROCHIP_UNIQUE_CONSTRAINT)) {
				return true;
			}
			cause = cause.getCause();
		}
		return false;
	}

}
