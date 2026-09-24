package com.horsetransport.horse;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.horsetransport.common.api.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class HorseControllerTest {

	private HorseService horseService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		horseService = org.mockito.Mockito.mock(HorseService.class);
		mockMvc = MockMvcBuilders.standaloneSetup(new HorseController(horseService))
				.setControllerAdvice(new GlobalExceptionHandler())
				.build();
	}

	@Test
	void createsHorse() throws Exception {
		UUID horseId = UUID.fromString("22222222-2222-2222-2222-222222222222");
		when(horseService.create(any(CreateHorseRequest.class))).thenReturn(response(horseId));

		mockMvc.perform(post("/api/v1/horses")
				.contentType(MediaType.APPLICATION_JSON)
				.content(validRequest()))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").value(horseId.toString()))
				.andExpect(jsonPath("$.name").value("Thunder"))
				.andExpect(jsonPath("$.microchipId").value("985141000123456"));
	}

	@Test
	void rejectsBlankMicrochipId() throws Exception {
		mockMvc.perform(post("/api/v1/horses")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{
						  "name": "Thunder",
						  "microchipId": " "
						}
						"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
				.andExpect(jsonPath("$.message").value("microchipId: microchipId is required"))
				.andExpect(jsonPath("$.timestamp").exists());
	}

	@Test
	void returnsConflictForDuplicateMicrochip() throws Exception {
		when(horseService.create(any(CreateHorseRequest.class)))
				.thenThrow(new DuplicateMicrochipException());

		mockMvc.perform(post("/api/v1/horses")
				.contentType(MediaType.APPLICATION_JSON)
				.content(validRequest()))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("DUPLICATE_MICROCHIP"))
				.andExpect(jsonPath("$.message").value("A horse with this microchip ID already exists"))
				.andExpect(jsonPath("$.timestamp").exists());
	}

	@Test
	void listsCurrentCustomerHorses() throws Exception {
		UUID horseId = UUID.fromString("22222222-2222-2222-2222-222222222222");
		when(horseService.findCurrentCustomerHorses()).thenReturn(List.of(response(horseId)));

		mockMvc.perform(get("/api/v1/horses"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].id").value(horseId.toString()))
				.andExpect(jsonPath("$[0].microchipId").value("985141000123456"));
	}

	private String validRequest() {
		return """
				{
				  "name": "Thunder",
				  "passportNumber": "P-001",
				  "microchipId": "985141000123456",
				  "breed": "Thoroughbred",
				  "sex": "MALE",
				  "dateOfBirth": "2021-04-15",
				  "notes": "Optional notes"
				}
				""";
	}

	private HorseResponse response(UUID horseId) {
		return new HorseResponse(
				horseId,
				"Thunder",
				"P-001",
				"985141000123456",
				"Thoroughbred",
				"MALE",
				LocalDate.of(2021, 4, 15),
				"Optional notes");
	}

}
