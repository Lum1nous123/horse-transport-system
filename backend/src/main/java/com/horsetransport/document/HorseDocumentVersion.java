package com.horsetransport.document;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "horse_document_versions")
public class HorseDocumentVersion {

	@Id
	private UUID id;

	@ManyToOne(optional = false)
	@JoinColumn(name = "horse_document_id", nullable = false)
	private HorseDocument horseDocument;

	@Column(name = "version_no", nullable = false)
	private int versionNo;

	@Column(name = "file_url", nullable = false, length = 500)
	private String fileUrl;

	@Column(name = "expiry_date")
	private LocalDate expiryDate;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(nullable = false, columnDefinition = "document_version_status")
	private DocumentVersionStatus status;

	@Column(name = "is_current", nullable = false)
	private boolean current;

	@Column(name = "uploaded_by", nullable = false)
	private UUID uploadedBy;

	@Column(name = "uploaded_at", nullable = false)
	private LocalDateTime uploadedAt;

	@Column(name = "submitted_at")
	private LocalDateTime submittedAt;

	@Column(name = "reviewed_by")
	private UUID reviewedBy;

	@Column(name = "reviewed_at")
	private LocalDateTime reviewedAt;

	@Column(name = "rejection_reason", columnDefinition = "text")
	private String rejectionReason;

	@Column(name = "created_at", nullable = false)
	private LocalDateTime createdAt;

	@Column(name = "updated_at")
	private LocalDateTime updatedAt;

	protected HorseDocumentVersion() {
	}

	HorseDocumentVersion(HorseDocument document, int versionNo, String fileUrl, LocalDate expiryDate,
			UUID uploadedBy) {
		this.id = UUID.randomUUID();
		this.horseDocument = document;
		this.versionNo = versionNo;
		this.fileUrl = fileUrl;
		this.expiryDate = expiryDate;
		this.status = DocumentVersionStatus.DRAFT;
		this.current = true;
		this.uploadedBy = uploadedBy;
		this.uploadedAt = LocalDateTime.now();
		this.createdAt = this.uploadedAt;
	}

	@PrePersist
	void prePersist() {
		if (id == null) id = UUID.randomUUID();
		if (status == null) status = DocumentVersionStatus.DRAFT;
		if (uploadedAt == null) uploadedAt = LocalDateTime.now();
		if (createdAt == null) createdAt = LocalDateTime.now();
	}

	@PreUpdate
	void preUpdate() {
		updatedAt = LocalDateTime.now();
	}

	void replaceDraft(String replacementUrl, LocalDate replacementExpiryDate, UUID actorUserId) {
		requireCurrentDraft("replaced");
		fileUrl = replacementUrl;
		expiryDate = replacementExpiryDate;
		uploadedBy = actorUserId;
		uploadedAt = LocalDateTime.now();
	}

	void restoreAfterReplaceFailure(String previousUrl, LocalDate previousExpiryDate,
			UUID previousUploadedBy, LocalDateTime previousUploadedAt) {
		fileUrl = previousUrl;
		expiryDate = previousExpiryDate;
		uploadedBy = previousUploadedBy;
		uploadedAt = previousUploadedAt;
	}

	void submit() {
		requireCurrentDraft("submitted");
		status = DocumentVersionStatus.PENDING_REVIEW;
		submittedAt = LocalDateTime.now();
	}

	void approve(UUID actorUserId) {
		requireCurrentPendingReview();
		status = DocumentVersionStatus.APPROVED;
		reviewedBy = actorUserId;
		reviewedAt = LocalDateTime.now();
		rejectionReason = null;
	}

	void reject(UUID actorUserId, String reason) {
		requireCurrentPendingReview();
		if (reason == null || reason.isBlank()) {
			throw new DocumentReviewValidationException("Rejection reason must not be blank");
		}
		status = DocumentVersionStatus.REJECTED;
		reviewedBy = actorUserId;
		reviewedAt = LocalDateTime.now();
		rejectionReason = reason.trim();
	}

	void makeHistorical() {
		current = false;
	}

	void restoreCurrentAfterCreationFailure() {
		current = true;
	}

	void restoreDraftAfterSubmitFailure() {
		if (status == DocumentVersionStatus.PENDING_REVIEW) {
			status = DocumentVersionStatus.DRAFT;
			submittedAt = null;
		}
	}

	void restorePendingAfterReviewFailure() {
		if (status == DocumentVersionStatus.APPROVED || status == DocumentVersionStatus.REJECTED) {
			status = DocumentVersionStatus.PENDING_REVIEW;
			reviewedBy = null;
			reviewedAt = null;
			rejectionReason = null;
		}
	}

	void requireCurrentDraft(String action) {
		if (!current || status != DocumentVersionStatus.DRAFT) {
			throw new DocumentVersionConflictException("Only the current DRAFT version can be " + action);
		}
	}

	private void requireCurrentPendingReview() {
		if (!current || status != DocumentVersionStatus.PENDING_REVIEW) {
			throw new DocumentVersionConflictException(
					"Only the current PENDING_REVIEW version can be reviewed");
		}
	}

	public UUID getId() { return id; }
	public UUID getHorseDocumentId() { return horseDocument.getId(); }
	public DocumentType getDocumentType() { return horseDocument.getDocumentType(); }
	public int getVersionNo() { return versionNo; }
	public String getFileUrl() { return fileUrl; }
	public LocalDate getExpiryDate() { return expiryDate; }
	public DocumentVersionStatus getStatus() { return status; }
	public boolean isCurrent() { return current; }
	public UUID getUploadedBy() { return uploadedBy; }
	public LocalDateTime getUploadedAt() { return uploadedAt; }
	public LocalDateTime getSubmittedAt() { return submittedAt; }
	public UUID getReviewedBy() { return reviewedBy; }
	public LocalDateTime getReviewedAt() { return reviewedAt; }
	public String getRejectionReason() { return rejectionReason; }
}
