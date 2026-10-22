package com.horsetransport.route;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.function.BooleanSupplier;

import jakarta.persistence.EntityManager;
import com.horsetransport.audit.AuditEntityType;
import com.horsetransport.audit.StatusAuditRecorder;
import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.OrderDeliveredEvent;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import com.horsetransport.user.UserStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Shared sequence policy for ROAD and AIR execution handlers.
 * Mode handlers validate their own execution requirements, then invoke these
 * methods in the same transaction to apply the covered RouteLeg/Order changes.
 */
@Service
public class RouteLegExecutionCoordinator {

	private final RouteLegRepository routeLegRepository;
	private final RoutePlanRepository routePlanRepository;
	private final TransportOrderRepository orderRepository;
	private final RoadLegVehicleRepository roadLegVehicleRepository;
	private final RoadVehicleExecutionRepository roadExecutionRepository;
	private final AirLegExecutionRepository airExecutionRepository;
	private final UserRepository userRepository;
	private final CurrentUserProvider currentUserProvider;
	private final StatusAuditRecorder auditRecorder;
	private final EntityManager entityManager;
	private final ApplicationEventPublisher eventPublisher;
	private final Clock clock;

	public RouteLegExecutionCoordinator(RouteLegRepository routeLegRepository,
			RoutePlanRepository routePlanRepository, TransportOrderRepository orderRepository,
			RoadLegVehicleRepository roadLegVehicleRepository,
			RoadVehicleExecutionRepository roadExecutionRepository,
			AirLegExecutionRepository airExecutionRepository, UserRepository userRepository,
			CurrentUserProvider currentUserProvider, StatusAuditRecorder auditRecorder,
			EntityManager entityManager, ApplicationEventPublisher eventPublisher, Clock clock) {
		this.routeLegRepository = routeLegRepository;
		this.routePlanRepository = routePlanRepository;
		this.orderRepository = orderRepository;
		this.roadLegVehicleRepository = roadLegVehicleRepository;
		this.roadExecutionRepository = roadExecutionRepository;
		this.airExecutionRepository = airExecutionRepository;
		this.userRepository = userRepository;
		this.currentUserProvider = currentUserProvider;
		this.auditRecorder = auditRecorder;
		this.entityManager = entityManager;
		this.eventPublisher = eventPublisher;
		this.clock = clock;
	}

	@Transactional(propagation = Propagation.MANDATORY)
	public void startCurrentLeg(UUID routeLegId) {
		startCurrentLeg(routeLegId, false);
	}

	/**
	 * ROAD has independent Vehicle executions. Once one Driver has started the
	 * RouteLeg, other assigned Drivers may start their own execution without
	 * applying the RouteLeg/Order transition a second time.
	 */
	@Transactional(propagation = Propagation.MANDATORY)
	public void startRoadVehicleExecution(UUID routeLegId) {
		startCurrentLeg(routeLegId, true);
	}

	private void startCurrentLeg(UUID routeLegId, boolean allowAlreadyInProgress) {
		LockedContext context = lockContext(routeLegId);
		List<RouteLeg> legs = context.legs();
		int index = indexOf(legs, routeLegId);
		RouteLeg leg = legs.get(index);
		if (context.plan().getStatus() != RoutePlanStatus.APPROVED) {
			throw new RoutePlanValidationException("Only a locked Route Plan can start execution");
		}
		for (int prior = 0; prior < index; prior++) {
			if (legs.get(prior).getStatus() != RouteLegStatus.COMPLETED) {
				throw new RoutePlanValidationException("A RouteLeg cannot start before all earlier legs complete");
			}
		}
		for (int later = index + 1; later < legs.size(); later++) {
			if (legs.get(later).getStatus() != RouteLegStatus.PLANNED) {
				throw new RoutePlanValidationException("Only the next ordered RouteLeg can be READY");
			}
		}
		if (leg.getStatus() == RouteLegStatus.IN_PROGRESS && allowAlreadyInProgress
				&& context.order().getStatus() == OrderStatus.IN_PROGRESS) {
			requireAssignedActiveActor(leg);
			return;
		}
		if (leg.getStatus() != RouteLegStatus.READY) {
			throw new RoutePlanValidationException("Only the current READY RouteLeg can start");
		}
		UUID actorId = requireAssignedActiveActor(leg);

		if (index == 0) {
			if (context.order().getStatus() != OrderStatus.READY_TO_SHIP) {
				throw new RoutePlanValidationException("The first RouteLeg requires an Order in READY_TO_SHIP");
			}
			context.order().startTransport();
			orderRepository.save(context.order());
			auditRecorder.recordUserTransition(AuditEntityType.TRANSPORT_ORDER, context.order().getId(),
					OrderStatus.READY_TO_SHIP.name(), OrderStatus.IN_PROGRESS.name(), actorId, null);
		} else if (context.order().getStatus() != OrderStatus.IN_PROGRESS) {
			throw new RoutePlanValidationException("A later RouteLeg requires an IN_PROGRESS Order");
		}

		leg.start();
		routeLegRepository.save(leg);
		auditRecorder.recordUserTransition(AuditEntityType.ROUTE_LEG, leg.getId(),
				RouteLegStatus.READY.name(), RouteLegStatus.IN_PROGRESS.name(), actorId, null);
	}

	/** Completes only a non-final leg after the mode handler validates its execution. */
	@Transactional(propagation = Propagation.MANDATORY)
	public void completeNonFinalLeg(UUID routeLegId) {
		completeNonFinalLegWhenReady(routeLegId, () -> true);
	}

	/**
	 * Serializes the ROAD final-Vehicle aggregation with other Vehicle completion
	 * requests on the same Order. The callback runs after the Order/legs are locked.
	 */
	@Transactional(propagation = Propagation.MANDATORY)
	public boolean completeNonFinalLegWhenReady(UUID routeLegId, BooleanSupplier completionReady) {
		LockedContext context = lockContext(routeLegId);
		List<RouteLeg> legs = context.legs();
		int index = indexOf(legs, routeLegId);
		if (index == legs.size() - 1) {
			throw new RoutePlanValidationException("Final RouteLeg completion requires the PoD handover flow");
		}
		RouteLeg leg = legs.get(index);
		RouteLeg nextLeg = legs.get(index + 1);
		if (context.plan().getStatus() != RoutePlanStatus.APPROVED
				|| context.order().getStatus() != OrderStatus.IN_PROGRESS
				|| leg.getStatus() != RouteLegStatus.IN_PROGRESS) {
			throw new RoutePlanValidationException("Only the current in-progress leg can complete");
		}
		if (nextLeg.getStatus() != RouteLegStatus.PLANNED) {
			throw new RoutePlanValidationException("The next RouteLeg is not in the expected PLANNED state");
		}
		for (int later = index + 2; later < legs.size(); later++) {
			if (legs.get(later).getStatus() != RouteLegStatus.PLANNED) {
				throw new RoutePlanValidationException("Only the next ordered RouteLeg can be READY");
			}
		}
		if (!completionReady.getAsBoolean()) return false;
		UUID actorId = requireAssignedActiveActor(leg);

		leg.complete();
		nextLeg.markReady();
		routeLegRepository.saveAll(List.of(leg, nextLeg));
		auditRecorder.recordUserTransition(AuditEntityType.ROUTE_LEG, leg.getId(),
				RouteLegStatus.IN_PROGRESS.name(), RouteLegStatus.COMPLETED.name(), actorId, null);
		auditRecorder.recordUserTransition(AuditEntityType.ROUTE_LEG, nextLeg.getId(),
				RouteLegStatus.PLANNED.name(), RouteLegStatus.READY.name(), actorId, null);
		return true;
	}

	/** Completes the final leg and delivers its Order only after PoD readiness succeeds. */
	@Transactional(propagation = Propagation.MANDATORY)
	public boolean completeFinalLegWhenReady(UUID routeLegId, BooleanSupplier completionReady) {
		LockedContext context = lockContext(routeLegId);
		List<RouteLeg> legs = context.legs();
		int index = indexOf(legs, routeLegId);
		if (index != legs.size() - 1) {
			throw new RoutePlanValidationException("Only the final RouteLeg can complete the delivery flow");
		}
		RouteLeg leg = legs.get(index);
		if (context.plan().getStatus() != RoutePlanStatus.APPROVED
				|| context.order().getStatus() != OrderStatus.IN_PROGRESS
				|| leg.getStatus() != RouteLegStatus.IN_PROGRESS) {
			throw new RoutePlanValidationException("Final delivery requires an in-progress final RouteLeg and Order");
		}
		if (!completionReady.getAsBoolean()) return false;

		UUID actorId = requireAssignedActiveActor(leg);
		LocalDateTime deliveredAt = LocalDateTime.now(clock);
		leg.complete();
		context.order().deliver(deliveredAt);
		routeLegRepository.save(leg);
		orderRepository.save(context.order());
		auditRecorder.recordUserTransition(AuditEntityType.ROUTE_LEG, leg.getId(),
				RouteLegStatus.IN_PROGRESS.name(), RouteLegStatus.COMPLETED.name(), actorId, null);
		auditRecorder.recordUserTransition(AuditEntityType.TRANSPORT_ORDER, context.order().getId(),
				OrderStatus.IN_PROGRESS.name(), OrderStatus.DELIVERED.name(), actorId, null);
		eventPublisher.publishEvent(new OrderDeliveredEvent(context.order().getId(),
				context.order().getCustomerId(), leg.getId(), deliveredAt));
		return true;
	}

	private LockedContext lockContext(UUID routeLegId) {
		RouteLeg reference = routeLegRepository.findById(routeLegId)
				.orElseThrow(RoutePlanNotFoundException::new);
		RoutePlan plan = routePlanRepository.findById(reference.getRoutePlanId())
				.orElseThrow(() -> new RoutePlanNotFoundException());
		TransportOrder order = orderRepository.findByIdForUpdate(plan.getTransportOrderId())
				.orElseThrow(RoutePlanNotFoundException::new);
		List<RouteLeg> legs = routeLegRepository.findAllByRoutePlanIdForUpdate(plan.getId());
		legs.forEach(entityManager::refresh);
		return new LockedContext(plan, order, legs);
	}

	private int indexOf(List<RouteLeg> legs, UUID routeLegId) {
		for (int index = 0; index < legs.size(); index++) {
			if (legs.get(index).getId().equals(routeLegId)) return index;
		}
		throw new RoutePlanNotFoundException();
	}

	private UUID requireAssignedActiveActor(RouteLeg leg) {
		UUID actorId = currentUserProvider.getCurrentUserId();
		UserAccount actor = userRepository.findByIdForUpdate(actorId)
				.filter(user -> user.getStatus() == UserStatus.ACTIVE)
				.orElseThrow(() -> new AccessDeniedException("Only an assigned active execution staff member can act"));
		boolean assigned;
		if (leg.getLegType() == RouteLegType.AIR) {
			assigned = actor.getRole() == UserRole.ESCORT && airExecutionRepository.findByRouteLegId(leg.getId())
					.map(execution -> execution.getEscortId().equals(actorId)).orElse(false);
		} else {
			List<UUID> vehicleIds = roadLegVehicleRepository.findAllByRouteLegId(leg.getId()).stream()
					.map(RoadLegVehicle::getId).toList();
			assigned = roadExecutionRepository.findAllByRoadLegVehicleIdIn(vehicleIds).stream()
					.anyMatch(execution -> (actor.getRole() == UserRole.DRIVER
							&& execution.getDriverId().equals(actorId))
							|| (actor.getRole() == UserRole.ESCORT
									&& execution.getEscortId().equals(actorId)));
		}
		if (!assigned) throw new AccessDeniedException("Only an assigned execution staff member can act on this RouteLeg");
		return actorId;
	}

	private record LockedContext(RoutePlan plan, TransportOrder order, List<RouteLeg> legs) { }
}
