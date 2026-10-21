package com.horsetransport.document;

import java.util.List;
import java.util.UUID;

import com.horsetransport.order.OrderHorseDocumentStatus;

public record HorseDocumentChecklistResponse(UUID orderHorseId, UUID horseId, String horseName, String microchipId,
		OrderHorseDocumentStatus documentStatus, List<HorseDocumentItemResponse> documents) {
}
