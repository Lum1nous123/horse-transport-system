package com.horsetransport.document;

import java.util.UUID;

public record HorseDocumentItemResponse(UUID id, DocumentType documentType, boolean required) {
}
