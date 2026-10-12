package com.horsetransport.route;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RoutePlanReviewRepository extends JpaRepository<RoutePlanReview, UUID> {

	List<RoutePlanReview> findAllByDecisionOrderBySubmittedAtAsc(RoutePlanReviewDecision decision);

	Optional<RoutePlanReview> findFirstByRoutePlanIdAndDecisionOrderBySubmissionNoDesc(
			UUID routePlanId, RoutePlanReviewDecision decision);

	@Query("select coalesce(max(r.submissionNo), 0) from RoutePlanReview r "
			+ "where r.routePlanId = :routePlanId")
	int maxSubmissionNo(@Param("routePlanId") UUID routePlanId);
}
