package com.horsetransport.route;

import java.util.UUID;

public record FrcPlanningHorseResponse(
		UUID orderHorseId,
		UUID horseId) {
}