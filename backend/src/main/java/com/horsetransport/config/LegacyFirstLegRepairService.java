package com.horsetransport.config;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.horsetransport.audit.AuditEntityType;
import com.horsetransport.audit.StatusAuditLogRepository;
import com.horsetransport.audit.StatusAuditRecorder;
import com.horsetransport.delivery.ProofOfDeliveryRepository;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.route.ExecutionStatus;
import com.horsetransport.route.RoadLegVehicle;
import com.horsetransport.route.RoadLegVehicleRepository;
import com.horsetransport.route.RoadVehicleExecution;
import com.horsetransport.route.RoadVehicleExecutionRepository;
import com.horsetransport.route.RouteLeg;
import com.horsetransport.route.RouteLegRepository;
import com.horsetransport.route.RouteLegStatus;
import com.horsetransport.route.RouteLegType;
import com.horsetransport.route.RoutePlan;
import com.horsetransport.route.RoutePlanRepository;
import com.horsetransport.route.RoutePlanStatus;
import com.horsetransport.route.VehicleCheckpointArrivalRepository;
import com.horsetransport.route.WelfareEvidenceRepository;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import com.horsetransport.user.UserStatus;
import jakarta.persistence.EntityManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

public class LegacyFirstLegRepairService {
	public static final List<String> APPROVED_ORDERS = List.of(
			"ORD-000004", "ORD-000002", "ORD-uYWWbNGJTD64ScWyilt1uw");
	static final String REASON = "Legacy backfill: route approved before first-leg READY activation (465f124)";

	private final EntityManager entityManager;
	private final TransportOrderRepository orders;
	private final RoutePlanRepository plans;
	private final RouteLegRepository legs;
	private final RoadLegVehicleRepository roadVehicles;
	private final RoadVehicleExecutionRepository roadExecutions;
	private final VehicleCheckpointArrivalRepository arrivals;
	private final WelfareEvidenceRepository welfare;
	private final ProofOfDeliveryRepository proofs;
	private final UserRepository users;
	private final StatusAuditLogRepository audits;
	private final StatusAuditRecorder auditRecorder;

	public LegacyFirstLegRepairService(EntityManager entityManager, TransportOrderRepository orders,
			RoutePlanRepository plans, RouteLegRepository legs, RoadLegVehicleRepository roadVehicles,
			RoadVehicleExecutionRepository roadExecutions, VehicleCheckpointArrivalRepository arrivals,
			WelfareEvidenceRepository welfare, ProofOfDeliveryRepository proofs, UserRepository users,
			StatusAuditLogRepository audits, StatusAuditRecorder auditRecorder) {
		this.entityManager = entityManager; this.orders = orders; this.plans = plans; this.legs = legs;
		this.roadVehicles = roadVehicles; this.roadExecutions = roadExecutions; this.arrivals = arrivals;
		this.welfare = welfare; this.proofs = proofs; this.users = users; this.audits = audits;
		this.auditRecorder = auditRecorder;
	}

	@Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
	public RepairResult inspect(String orderCode) { return validate(orderCode, false); }

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public RepairResult repair(String orderCode) {
		RepairResult result = validate(orderCode, true);
		if (result.outcome() == Outcome.ALREADY_REPAIRED) return result;
		RouteLeg first = legs.findAllByRoutePlanIdForUpdate(result.routePlanId()).get(0);
		first.markReady();
		legs.saveAndFlush(first);
		auditRecorder.recordSystemTransition(AuditEntityType.ROUTE_LEG, first.getId(),
				RouteLegStatus.PLANNED.name(), RouteLegStatus.READY.name(), REASON);
		return result.withOutcome(Outcome.REPAIRED, RouteLegStatus.READY);
	}

	private RepairResult validate(String orderCode, boolean lock) {
		if (!APPROVED_ORDERS.contains(orderCode) || APPROVED_ORDERS.size() != 3
				|| Set.copyOf(APPROVED_ORDERS).size() != 3) fail(orderCode, "Order is outside the exact approved allowlist");
		UUID orderId = entityManager.createQuery("select o.id from TransportOrder o where o.orderCode = :code", UUID.class)
				.setParameter("code", orderCode).getResultStream().findFirst()
				.orElseThrow(() -> failure(orderCode, "Order was not found"));
		TransportOrder order = lock ? orders.findByIdForUpdate(orderId).orElseThrow() : orders.findById(orderId).orElseThrow();
		if (order.getStatus() != OrderStatus.READY_TO_SHIP) fail(orderCode, "Order is not READY_TO_SHIP");
		RoutePlan plan = lock ? plans.findByTransportOrderIdForUpdate(orderId).orElseThrow()
				: plans.findByTransportOrderId(orderId).orElseThrow();
		if (plan.getStatus() != RoutePlanStatus.APPROVED || plan.getLockedAt() == null || plan.getApprovedAt() == null)
			fail(orderCode, "Route plan is not approved and locked");
		List<RouteLeg> ordered = lock ? legs.findAllByRoutePlanIdForUpdate(plan.getId())
				: legs.findAllByRoutePlanIdOrderBySequenceNoAsc(plan.getId());
		if (ordered.isEmpty() || ordered.get(0).getSequenceNo() != 1) fail(orderCode, "First RouteLeg is missing");
		RouteLeg first = ordered.get(0);
		boolean auditExists = audits.existsByEntityTypeAndEntityIdAndOldStatusAndNewStatus(
				AuditEntityType.ROUTE_LEG, first.getId(), RouteLegStatus.PLANNED.name(), RouteLegStatus.READY.name());
		if (first.getStatus() == RouteLegStatus.READY && auditExists)
			return result(order, plan, first, ordered, Outcome.ALREADY_REPAIRED);
		if (first.getStatus() != RouteLegStatus.PLANNED) fail(orderCode, "First RouteLeg is not PLANNED");
		if (auditExists) fail(orderCode, "Readiness audit already exists while the first RouteLeg is PLANNED");
		if (ordered.stream().skip(1).anyMatch(leg -> leg.getStatus() != RouteLegStatus.PLANNED))
			fail(orderCode, "A later RouteLeg is not PLANNED");
		if (first.getLegType() != RouteLegType.ROAD) fail(orderCode, "Approved repair set expected a ROAD first leg");
		List<RoadLegVehicle> vehicles = roadVehicles.findAllByRouteLegId(first.getId());
		if (vehicles.isEmpty()) fail(orderCode, "First RouteLeg has no Vehicle allocation");
		List<RoadVehicleExecution> executions = roadExecutions.findAllByRoadLegVehicleIdIn(
				vehicles.stream().map(RoadLegVehicle::getId).toList());
		if (executions.size() != vehicles.size() || executions.stream().anyMatch(e -> e.getStatus() != ExecutionStatus.NOT_STARTED
				|| e.getStartedAt() != null || e.getDestinationArrivedAt() != null || e.getCompletedAt() != null))
			fail(orderCode, "First-leg executions are missing or have recorded progress");
		for (RoadVehicleExecution execution : executions) {
			var driver = users.findById(execution.getDriverId()).orElseThrow();
			var escort = users.findById(execution.getEscortId()).orElseThrow();
			if (driver.getRole() != UserRole.DRIVER || driver.getStatus() != UserStatus.ACTIVE
					|| escort.getRole() != UserRole.ESCORT || escort.getStatus() != UserStatus.ACTIVE)
				fail(orderCode, "First-leg Driver or Escort assignment is not active and role-correct");
		}
		List<UUID> executionIds = executions.stream().map(RoadVehicleExecution::getId).toList();
		if (!arrivals.findAllByRoadVehicleExecutionIdIn(executionIds).isEmpty()
				|| !welfare.findAllByRoadVehicleExecutionIdIn(executionIds).isEmpty()
				|| !proofs.findAllByRoadVehicleExecutionIdIn(executionIds).isEmpty())
			fail(orderCode, "First-leg execution evidence or progress already exists");
		return result(order, plan, first, ordered, Outcome.ELIGIBLE);
	}

	private RepairResult result(TransportOrder order, RoutePlan plan, RouteLeg first,
			List<RouteLeg> ordered, Outcome outcome) {
		return new RepairResult(order.getOrderCode(), order.getId(), plan.getId(), first.getId(),
				first.getStatus(), outcome, ordered.stream().skip(1).map(RouteLeg::getStatus).toList());
	}
	private static void fail(String code, String reason) { throw failure(code, reason); }
	private static IllegalStateException failure(String code, String reason) {
		return new IllegalStateException(code + ": " + reason);
	}

	public enum Outcome { ELIGIBLE, REPAIRED, ALREADY_REPAIRED }
	public record RepairResult(String orderCode, UUID orderId, UUID routePlanId, UUID firstLegId,
			RouteLegStatus firstLegStatus, Outcome outcome, List<RouteLegStatus> laterLegStatuses) {
		RepairResult withOutcome(Outcome value, RouteLegStatus status) {
			return new RepairResult(orderCode, orderId, routePlanId, firstLegId, status, value, laterLegStatuses);
		}
	}
}
