package com.horsetransport.document;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Map;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.springframework.stereotype.Component;

@Component
public class CloudinaryDocumentStorage implements DocumentStorage {

	private final Cloudinary cloudinary;

	public CloudinaryDocumentStorage(Cloudinary cloudinary) {
		this.cloudinary = cloudinary;
	}

	@Override
	public String upload(byte[] content, String contentType, String publicId, boolean overwrite) {
		try {
			Map<?, ?> result = cloudinary.uploader().upload(content, ObjectUtils.asMap(
					"public_id", publicId,
					"resource_type", "image",
					"overwrite", overwrite,
					"invalidate", true,
					"unique_filename", false,
					"use_filename", false));
			Object secureUrl = result.get("secure_url");
			if (!(secureUrl instanceof String url) || url.isBlank()) {
				throw new DocumentStorageException("Cloudinary did not return a secure URL");
			}
			return url;
		}
		catch (DocumentStorageException exception) {
			throw exception;
		}
		catch (IOException | RuntimeException exception) {
			throw new DocumentStorageException("Document upload failed", exception);
		}
	}

	@Override
	public void delete(String publicId) {
		try {
			Map<?, ?> result = cloudinary.uploader().destroy(publicId, ObjectUtils.asMap(
					"resource_type", "image", "invalidate", true));
			Object deletionResult = result.get("result");
			if (!"ok".equals(deletionResult) && !"not found".equals(deletionResult)) {
				throw new DocumentStorageException("Cloudinary could not delete the document");
			}
		}
		catch (DocumentStorageException exception) {
			throw exception;
		}
		catch (IOException | RuntimeException exception) {
			throw new DocumentStorageException("Document deletion failed", exception);
		}
	}

	@Override
	public void deleteByUrl(String fileUrl) {
		delete(publicIdFromUrl(fileUrl));
	}

	private String publicIdFromUrl(String fileUrl) {
		try {
			String path = new URI(fileUrl).getPath();
			String marker = "/image/upload/";
			int markerIndex = path.indexOf(marker);
			if (markerIndex < 0) throw new DocumentStorageException("Stored Cloudinary URL is invalid");

			String objectPath = path.substring(markerIndex + marker.length());
			if (objectPath.matches("v\\d+/.*")) objectPath = objectPath.substring(objectPath.indexOf('/') + 1);
			int extensionIndex = objectPath.lastIndexOf('.');
			if (extensionIndex <= 0) throw new DocumentStorageException("Stored Cloudinary URL is invalid");
			return objectPath.substring(0, extensionIndex);
		}
		catch (URISyntaxException | NullPointerException exception) {
			throw new DocumentStorageException("Stored Cloudinary URL is invalid", exception);
		}
	}
}
