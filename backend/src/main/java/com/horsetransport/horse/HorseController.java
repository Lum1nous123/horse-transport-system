package com.horsetransport.horse;

import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/horses")
public class HorseController {

	private final HorseService horseService;

	public HorseController(HorseService horseService) {
		this.horseService = horseService;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public HorseResponse create(@Valid @RequestBody CreateHorseRequest request) {
		return horseService.create(request);
	}

	@GetMapping
	public List<HorseResponse> findCurrentCustomerHorses() {
		return horseService.findCurrentCustomerHorses();
	}

}
