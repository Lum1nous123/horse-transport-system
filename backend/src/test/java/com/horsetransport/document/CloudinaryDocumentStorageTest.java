package com.horsetransport.document;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.Map;

import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CloudinaryDocumentStorageTest {

	@Mock private Cloudinary cloudinary;
	@Mock private Uploader uploader;
	private CloudinaryDocumentStorage storage;

	@BeforeEach
	void setUp() {
		when(cloudinary.uploader()).thenReturn(uploader);
		storage = new CloudinaryDocumentStorage(cloudinary);
	}

	@Test
	void uploadsUsingDeterministicIdSecureUrlAndOverwriteFlag() throws IOException {
		when(uploader.upload(any(byte[].class), any(Map.class)))
				.thenReturn(Map.of("secure_url", "https://res.cloudinary.com/test/document.pdf"));

		String url = storage.upload(new byte[] {1}, "application/pdf", "orders/order/documents/doc/v1", true);

		assertThat(url).startsWith("https://");
		ArgumentCaptor<Map> options = ArgumentCaptor.forClass(Map.class);
		verify(uploader).upload(any(byte[].class), options.capture());
		assertThat(options.getValue()).containsEntry("public_id", "orders/order/documents/doc/v1")
				.containsEntry("resource_type", "image")
				.containsEntry("overwrite", true);
	}

	@Test
	void treatsNotFoundDeleteAsIdempotent() throws IOException {
		when(uploader.destroy(any(String.class), any(Map.class))).thenReturn(Map.of("result", "not found"));

		storage.delete("orders/order/documents/doc/v1");

		verify(uploader).destroy(any(String.class), any(Map.class));
	}

	@Test
	void deletesGeneratedObjectBySecureUrl() throws IOException {
		when(uploader.destroy(any(String.class), any(Map.class))).thenReturn(Map.of("result", "ok"));

		storage.deleteByUrl("https://res.cloudinary.com/demo/image/upload/v123456789/horse-transport/"
				+ "orders/order/documents/document/v1-replacement-abc.pdf");

		verify(uploader).destroy(eq("horse-transport/orders/order/documents/document/v1-replacement-abc"),
				any(Map.class));
	}

	@Test
	void wrapsCloudinaryIoFailures() throws IOException {
		when(uploader.upload(any(byte[].class), any(Map.class))).thenThrow(new IOException("network"));

		assertThatThrownBy(() -> storage.upload(new byte[] {1}, "image/png", "id", false))
				.isInstanceOf(DocumentStorageException.class).hasMessage("Document upload failed");
	}
}
