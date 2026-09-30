package com.horsetransport.document;

public interface DocumentStorage {

	String upload(byte[] content, String contentType, String publicId, boolean overwrite);

	void delete(String publicId);

	void deleteByUrl(String fileUrl);
}
