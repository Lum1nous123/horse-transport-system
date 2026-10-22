package com.horsetransport.delivery;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.horsetransport.common.api.GlobalExceptionHandler;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.route.RouteLegStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.multipart.MultipartFile;

class FinalHandoverControllerTest {

	private static final UUID SCOPE_ID = UUID.randomUUID();
	private static final UUID PROOF_ID = UUID.randomUUID();
	private static final UUID LEG_ID = UUID.randomUUID();
	private static final UUID ESCORT_ID = UUID.randomUUID();

	private FinalHandoverService service;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		service = mock(FinalHandoverService.class);
		mockMvc = MockMvcBuilders.standaloneSetup(new FinalHandoverController(service))
				.setControllerAdvice(new GlobalExceptionHandler()).build();
	}

	@Test
	void exposesRoadAndAirMultipartProofOfDeliveryEndpoints() throws Exception {
		when(service.recordRoadHandover(eq(SCOPE_ID), eq("Recipient"),
				any(MultipartFile.class), eq("Safe"))).thenReturn(response(SCOPE_ID, null));
		when(service.recordAirHandover(eq(SCOPE_ID), eq("Recipient"),
				any(MultipartFile.class), eq(null))).thenReturn(response(null, SCOPE_ID));

		mockMvc.perform(multipart("/api/v1/road-executions/vehicles/{id}/proof-of-delivery", SCOPE_ID)
				.file(photo()).param("recipientName", "Recipient").param("note", "Safe"))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.roadVehicleExecutionId").value(SCOPE_ID.toString()))
				.andExpect(jsonPath("$.orderStatus").value("DELIVERED"));

		mockMvc.perform(multipart("/api/v1/air-executions/legs/{id}/proof-of-delivery", SCOPE_ID)
				.file(photo()).param("recipientName", "Recipient"))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.airLegExecutionId").value(SCOPE_ID.toString()));
	}

	private ProofOfDeliveryResponse response(UUID roadExecutionId, UUID airExecutionId) {
		return new ProofOfDeliveryResponse(PROOF_ID, roadExecutionId, airExecutionId, LEG_ID,
				List.of(), "Recipient", "https://storage.example/pod.jpg", null, ESCORT_ID,
				LocalDateTime.of(2026, 10, 22, 10, 0), LocalDateTime.of(2026, 10, 22, 10, 0),
				1, 1, RouteLegStatus.COMPLETED, OrderStatus.DELIVERED);
	}

	private MockMultipartFile photo() {
		return new MockMultipartFile("photo", "pod.jpg", "image/jpeg",
				new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff});
	}
}
