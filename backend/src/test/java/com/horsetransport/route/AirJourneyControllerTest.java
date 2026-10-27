package com.horsetransport.route;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.util.UUID;

import com.horsetransport.common.api.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.multipart.MultipartFile;

class AirJourneyControllerTest {

	private static final UUID LEG_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final UUID EXECUTION_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
	private static final UUID ESCORT_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
	private static final UUID WELFARE_ID = UUID.fromString("44444444-4444-4444-4444-444444444444");
	private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 22, 10, 30);

	private AirJourneyService service;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		service = mock(AirJourneyService.class);
		mockMvc = MockMvcBuilders.standaloneSetup(new AirJourneyController(service))
				.setControllerAdvice(new GlobalExceptionHandler()).build();
	}

	@Test
	void exposesStartAndDestinationEndpoints() throws Exception {
		when(service.start(LEG_ID)).thenReturn(execution(ExecutionStatus.IN_PROGRESS));
		when(service.arriveAtDestination(LEG_ID)).thenReturn(execution(ExecutionStatus.DESTINATION));

		mockMvc.perform(post(path("/start")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("IN_PROGRESS"));
		mockMvc.perform(post(path("/destination")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("DESTINATION"));
	}

	@Test
	void exposesExplicitCompleteEndpoint() throws Exception {
		when(service.complete(LEG_ID)).thenReturn(execution(ExecutionStatus.COMPLETED));

		mockMvc.perform(post(path("/complete")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("COMPLETED"));
	}

	@Test
	void mapsLifecycleConflictToHttp409() throws Exception {
		when(service.arriveAtDestination(LEG_ID))
				.thenThrow(new ExecutionConflictException("AIR RouteLeg is not in progress"));

		mockMvc.perform(post(path("/destination")))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("EXECUTION_CONFLICT"))
				.andExpect(jsonPath("$.message").value("AIR RouteLeg is not in progress"));
	}

	@Test
	void keepsInvalidFieldValidationAtHttp400() throws Exception {
		MockMultipartFile photo = new MockMultipartFile("photo", "welfare.jpg", "image/jpeg",
				new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff});
		when(service.recordFinalWelfare(eq(LEG_ID), any(MultipartFile.class), eq(" ")))
				.thenThrow(new RoutePlanValidationException("A welfare note is required"));

		mockMvc.perform(multipart(path("/destination/welfare")).file(photo).param("note", " "))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("ROUTE_PLAN_VALIDATION_ERROR"));
	}

	@Test
	void exposesMultipartFinalWelfareEndpoint() throws Exception {
		MockMultipartFile photo = new MockMultipartFile("photo", "welfare.jpg", "image/jpeg",
				new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff});
		when(service.recordFinalWelfare(eq(LEG_ID), any(MultipartFile.class), eq("Horse is well")))
				.thenReturn(new WelfareEvidenceResponse(WELFARE_ID, null, EXECUTION_ID, null,
						WelfareEventType.FINAL_DESTINATION, "https://storage.example/welfare.jpg",
						"Horse is well", ESCORT_ID, NOW));

		mockMvc.perform(multipart(path("/destination/welfare"))
				.file(photo).param("note", "Horse is well"))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.airLegExecutionId").value(EXECUTION_ID.toString()))
				.andExpect(jsonPath("$.eventType").value("FINAL_DESTINATION"));
	}

	private String path(String suffix) {
		return "/api/v1/air-executions/legs/" + LEG_ID + suffix;
	}

	private AirExecutionResponse execution(ExecutionStatus status) {
		return new AirExecutionResponse(EXECUTION_ID, LEG_ID, ESCORT_ID, status,
				NOW.minusHours(6), status == ExecutionStatus.DESTINATION ? NOW : null, null);
	}
}
