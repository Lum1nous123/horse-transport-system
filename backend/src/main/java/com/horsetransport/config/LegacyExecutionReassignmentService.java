package com.horsetransport.config;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

public class LegacyExecutionReassignmentService {
	public static final List<Assignment> ASSIGNMENTS = List.of(
			new Assignment("ORD-000004", UUID.fromString("1076c286-87d5-482f-b000-c53ea32311b0"),
					"driver1.s3demo@example.com", "escort1.s3demo@example.com"),
			new Assignment("ORD-000002", UUID.fromString("299a94b9-8265-4c00-8cda-dce60d6bac90"),
					"driver2.s3demo@example.com", "escort2.s3demo@example.com"),
			new Assignment("ORD-000002", UUID.fromString("eda2d4b5-f7b7-4feb-be18-de3b900c29e1"),
					"driver2.s3demo@example.com", "escort2.s3demo@example.com"),
			new Assignment("ORD-uYWWbNGJTD64ScWyilt1uw", UUID.fromString("4aa7ca43-f50c-4429-b290-d3cb5963a6fc"),
					"driver1.s3demo@example.com", "escort1.s3demo@example.com"));

	private final JdbcTemplate jdbc;
	public LegacyExecutionReassignmentService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

	@Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
	public Result inspect(Assignment assignment) { return validate(assignment, false); }

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public Result reassign(Assignment assignment) {
		Result result = validate(assignment, true);
		if (result.outcome() == Outcome.ALREADY_ASSIGNED) return result;
		int updated = jdbc.update("update road_vehicle_executions set driver_id=?, escort_id=? where id=? and status='NOT_STARTED'",
				result.targetDriverId(), result.targetEscortId(), assignment.executionId());
		if (updated != 1) throw failure(assignment, "Guarded assignment update affected " + updated + " rows");
		return new Result(assignment, result.vehiclePlate(), result.sequenceNo(), result.previousDriverEmail(),
				result.previousEscortEmail(), result.targetDriverId(), result.targetEscortId(), Outcome.REASSIGNED);
	}

	private Result validate(Assignment assignment, boolean lock) {
		if (!ASSIGNMENTS.contains(assignment) || ASSIGNMENTS.size() != 4
				|| ASSIGNMENTS.stream().map(Assignment::executionId).distinct().count() != 4)
			throw failure(assignment, "Execution is outside the exact approved allowlist");
		String suffix = lock ? " for update" : "";
		List<Map<String, Object>> rows = jdbc.queryForList("""
			select o.order_code,o.status order_status,rp.status plan_status,rp.locked_at,
			 rl.sequence_no,rl.status leg_status,v.plate_number,e.status execution_status,
			 e.started_at,e.destination_arrived_at,e.completed_at,du.email previous_driver,eu.email previous_escort
			 from road_vehicle_executions e
			 join road_leg_vehicles rlv on rlv.id=e.road_leg_vehicle_id
			 join vehicles v on v.id=rlv.vehicle_id join route_legs rl on rl.id=rlv.route_leg_id
			 join route_plans rp on rp.id=rl.route_plan_id join transport_orders o on o.id=rp.transport_order_id
			 join users du on du.id=e.driver_id join users eu on eu.id=e.escort_id where e.id=?""" + suffix,
				assignment.executionId());
		if (rows.size() != 1) throw failure(assignment, "Execution was not found uniquely");
		Map<String, Object> row = rows.get(0);
		if (!assignment.orderCode().equals(row.get("order_code"))) throw failure(assignment, "Execution belongs to a different Order");
		if (!"READY_TO_SHIP".equals(row.get("order_status")) || !"APPROVED".equals(row.get("plan_status"))
				|| row.get("locked_at") == null) throw failure(assignment, "Order or approved Route Plan is not ready");
		if (!("READY".equals(row.get("leg_status")) || "PLANNED".equals(row.get("leg_status"))))
			throw failure(assignment, "RouteLeg has entered execution");
		if (!"NOT_STARTED".equals(row.get("execution_status")) || row.get("started_at") != null
				|| row.get("destination_arrived_at") != null || row.get("completed_at") != null)
			throw failure(assignment, "Execution has recorded lifecycle progress");
		if (progressCount(assignment.executionId()) != 0) throw failure(assignment, "Execution evidence or progress exists");
		Target driver = target(assignment.driverEmail(), "DRIVER");
		Target escort = target(assignment.escortEmail(), "ESCORT");
		boolean same = assignment.driverEmail().equalsIgnoreCase((String) row.get("previous_driver"))
				&& assignment.escortEmail().equalsIgnoreCase((String) row.get("previous_escort"));
		return new Result(assignment, (String) row.get("plate_number"), ((Number) row.get("sequence_no")).intValue(),
				(String) row.get("previous_driver"), (String) row.get("previous_escort"), driver.id(), escort.id(),
				same ? Outcome.ALREADY_ASSIGNED : Outcome.ELIGIBLE);
	}

	private int progressCount(UUID executionId) {
		return jdbc.queryForObject("""
			select (select count(*) from vehicle_checkpoint_arrivals where road_vehicle_execution_id=?)
			 +(select count(*) from welfare_evidence where road_vehicle_execution_id=?)
			 +(select count(*) from proofs_of_delivery where road_vehicle_execution_id=?)""",
				Integer.class, executionId, executionId, executionId);
	}

	private Target target(String email, String role) {
		return jdbc.query("select id from users where lower(email)=lower(?) and role=?::user_role and status='ACTIVE'",
				(ResultSet result) -> {
					if (!result.next()) throw new IllegalStateException("Target " + role + " account is missing or inactive");
					UUID id = result.getObject(1, UUID.class);
					if (result.next()) throw new IllegalStateException("Target " + role + " account is not unique");
					return new Target(id);
				}, email, role);
	}

	private static IllegalStateException failure(Assignment assignment, String reason) {
		return new IllegalStateException(assignment.orderCode() + "/" + assignment.executionId() + ": " + reason);
	}
	private record Target(UUID id) { }
	public enum Outcome { ELIGIBLE, REASSIGNED, ALREADY_ASSIGNED }
	public record Assignment(String orderCode, UUID executionId, String driverEmail, String escortEmail) { }
	public record Result(Assignment assignment, String vehiclePlate, int sequenceNo, String previousDriverEmail,
			String previousEscortEmail, UUID targetDriverId, UUID targetEscortId, Outcome outcome) { }
}
