package com.horsetransport.document;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.UUID;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class DocumentVersionResponseTest {

	@ParameterizedTest
	@CsvSource({
			"HORSE_PASSPORT_OR_IDENTIFICATION, horse-passport.pdf",
			"VACCINATION_CERTIFICATE, vaccination-certificate.pdf",
			"VETERINARY_HEALTH_CERTIFICATE, veterinary-health-certificate.pdf",
			"OWNERSHIP_CERTIFICATE, ownership-certificate.pdf",
			"EXPORT_IMPORT_PERMIT, export-import-permit.pdf"
	})
	void derivesCleanDisplayNameWithoutChangingStorageUrl(DocumentType documentType, String expectedName) {
		HorseDocument document = mock(HorseDocument.class);
		when(document.getId()).thenReturn(UUID.randomUUID());
		when(document.getDocumentType()).thenReturn(documentType);
		String storageUrl = "https://res.cloudinary.com/demo/image/upload/v1/internal-random-id.pdf";
		HorseDocumentVersion version = new HorseDocumentVersion(document, 1, storageUrl, null,
				UUID.randomUUID());

		DocumentVersionResponse response = DocumentVersionResponse.from(version);

		assertThat(response.fileUrl()).isEqualTo(storageUrl);
		assertThat(response.displayName()).isEqualTo(expectedName);
	}
}
