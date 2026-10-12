package com.horsetransport.route;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "route_plan_reviews")
public class RoutePlanReview {

	@Id
	private UUID id;

	@Column(name = "route_plan_id", nullable = false)
	private UUID routePlanId;

	@Column(name = "submission_no", nullable = false)
	private Integer submissionNo;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(nullable = false, columnDefinition = "route_plan_review_decision")
	private RoutePlanReviewDecision decision;

	@Column(name = "submitted_by", nullable = false)
	private UUID submittedBy;

	@Column(name = "submitted_at", nullable = false)
	private LocalDateTime submittedAt;

	@Column(name = "decided_by")
	private UUID decidedBy;

	@Column(name = "decided_at")
	private LocalDateTime decidedAt;

	@Column(name = "return_reason")
	private String returnReason;

	protected RoutePlanReview() {
	}

	public RoutePlanReview(UUID routePlanId, Integer submissionNo, UUID submittedBy) {
		this.id = UUID.randomUUID();
		this.routePlanId = routePlanId;
		this.submissionNo = submissionNo;
		this.submittedBy = submittedBy;
		this.submittedAt = LocalDateTime.now();
		this.decision = RoutePlanReviewDecision.PENDING;
	}

	@PrePersist
	void prePersist() {
		if (id == null) {
			id = UUID.randomUUID();
		}
		if (decision == null) {
			decision = RoutePlanReviewDecision.PENDING;
		}
		if (submittedAt == null) {
			submittedAt = LocalDateTime.now();
		}
	}

	public void confirm(UUID logisticsManagerId) {
		decision = RoutePlanReviewDecision.CONFIRMED;
		decidedBy = logisticsManagerId;
		decidedAt = LocalDateTime.now();
		returnReason = null;
	}

	public void returnToFrc(UUID logisticsManagerId, String reason) {
		decision = RoutePlanReviewDecision.RETURNED;
		decidedBy = logisticsManagerId;
		decidedAt = LocalDateTime.now();
		returnReason = reason;
	}

	public UUID getId() {
		return id;
	}

	public UUID getRoutePlanId() {
		return routePlanId;
	}

	public Integer getSubmissionNo() {
		return submissionNo;
	}

	public RoutePlanReviewDecision getDecision() {
		return decision;
	}

	public UUID getSubmittedBy() {
		return submittedBy;
	}

	public LocalDateTime getSubmittedAt() {
		return submittedAt;
	}

	public UUID getDecidedBy() {
		return decidedBy;
	}

	public LocalDateTime getDecidedAt() {
		return decidedAt;
	}

	public String getReturnReason() {
		return returnReason;
	}
}
