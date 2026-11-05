package com.horsetransport.route;

import java.io.IOException;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.horsetransport.document.DocumentFileValidationException;
import com.horsetransport.document.DocumentStorage;
import com.horsetransport.document.DocumentStorageException;
import com.horsetransport.notification.NotificationService;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.route.RoutePlanStatus;
import com.horsetransport.security.CurrentUserProvider;
import com.horsetransport.user.UserAccount;
import com.horsetransport.user.UserRepository;
import com.horsetransport.user.UserRole;
import com.horsetransport.user.UserStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

@Service
public class RoadJourneyService {

	private static final Logger LOGGER = LoggerFactory.getLogger(RoadJourneyService.class);
	private static final long MAX_PHOTO_SIZE = 10L * 1024 * 1024;
	private static final Set<String> PHOTO_TYPES = Set.of("image/jpeg", "image/png");

	private final RoadLegVehicleRepository roadVehicleRepository;
	private final RoadVehicleExecutionRepository executionRepository;
	private final RouteLegRepository routeLegRepository;
	private final RoutePlanRepository routePlanRepository;
	private final CheckpointRepository checkpointRepository;
	private final VehicleCheckpointArrivalRepository arrivalRepository;
	private final WelfareEvidenceRepository welfareRepository;
	private final TransportOrderRepository orderRepository;
	private final UserRepository userRepository;
	private final CurrentUserProvider currentUserProvider;
	private final RouteLegExecutionCoordinator coordinator;
	private final NotificationService notificationService;
	private final DocumentStorage storage;
	private final Clock clock;

	public RoadJourneyService(RoadLegVehicleRepository roadVehicleRepository,
			RoadVehicleExecutionRepository executionRepository, RouteLegRepository routeLegRepository,
			RoutePlanRepository routePlanRepository, CheckpointRepository checkpointRepository,
			VehicleCheckpointArrivalRepository arrivalRepository, WelfareEvidenceRepository welfareRepository,
			TransportOrderRepository orderRepository, UserRepository userRepository,
			CurrentUserProvider currentUserProvider, RouteLegExecutionCoordinator coordinator,
			NotificationService notificationService, DocumentStorage storage, Clock clock) {
		this.roadVehicleRepository = roadVehicleRepository;
		this.executionRepository = executionRepository;
		this.routeLegRepository = routeLegRepository;
		this.routePlanRepository = routePlanRepository;
		this.checkpointRepository = checkpointRepository;
		this.arrivalRepository = arrivalRepository;
		this.welfareRepository = welfareRepository;
		this.orderRepository = orderRepository;
		this.userRepository = userRepository;
		this.currentUserProvider = currentUserProvider;
		this.coordinator = coordinator;
		this.notificationService = notificationService;
		this.storage = storage;
		this.clock = clock;
	}

	@Transactional
	public RoadExecutionResponse start(UUID roadLegVehicleId) {
		RoadContext context = loadContext(roadLegVehicleId);
		UUID actorId = requireAssignedActor(context.execution().getDriverId(), UserRole.DRIVER);
		if (context.execution().getStatus() != ExecutionStatus.NOT_STARTED) {
			return RoadExecutionResponse.from(context.execution());
		}
		if (context.leg().getStatus() != RouteLegStatus.READY
				&& context.leg().getStatus() != RouteLegStatus.IN_PROGRESS) {
			throw new ExecutionConflictException("The ROAD RouteLeg is not ready for execution");
		}
		coordinator.startRoadVehicleExecution(context.leg().getId());
		context.execution().start(LocalDateTime.now(clock));
		return RoadExecutionResponse.from(executionRepository.saveAndFlush(context.execution()));
	}

	@Transactional
	public CheckpointArrivalResponse arriveAtCheckpoint(UUID roadLegVehicleId, UUID checkpointId) {
		RoadContext context = loadContext(roadLegVehicleId);
		UUID actorId = requireAssignedActor(context.execution().getDriverId(), UserRole.DRIVER);
		var previous = arrivalRepository.findByRoadVehicleExecutionIdAndCheckpointId(
				context.execution().getId(), checkpointId);
		if (previous.isPresent()) return CheckpointArrivalResponse.from(previous.get());
		ensureLegInProgress(context);
		if (context.execution().getStatus() != ExecutionStatus.IN_PROGRESS) {
			throw new ExecutionConflictException("Vehicle must be in progress to record a checkpoint arrival");
		}
		Checkpoint checkpoint = checkpointRepository.findById(checkpointId)
				.orElseThrow(RoutePlanNotFoundException::new);
		if (!checkpoint.getRouteLegId().equals(context.leg().getId())) {
			throw new RoutePlanValidationException("Checkpoint does not belong to this ROAD RouteLeg");
		}
		List<Checkpoint> checkpoints = checkpointRepository
				.findAllByRouteLegIdOrderBySequenceNoAsc(context.leg().getId());
		List<VehicleCheckpointArrival> arrivals = arrivalRepository.findAllByRoadVehicleExecutionId(
				context.execution().getId());
		requireWelfareForLastReachedCheckpoint(context, arrivals);
		Set<UUID> reached = new HashSet<>(arrivals.stream()
				.map(VehicleCheckpointArrival::getCheckpointId).toList());
		Checkpoint next = checkpoints.stream().filter(item -> !reached.contains(item.getId())).findFirst()
				.orElseThrow(() -> new ExecutionConflictException("All planned checkpoints have already been reached"));
		if (!next.getId().equals(checkpointId)) {
			throw new ExecutionConflictException("Vehicle must reach checkpoints in their planned order");
		}
		VehicleCheckpointArrival arrival = arrivalRepository.saveAndFlush(new VehicleCheckpointArrival(
				context.execution().getId(), checkpointId, actorId, LocalDateTime.now(clock)));
		notificationService.createCheckpointReached(context.customerId(), context.planOrderId(), arrival.getId());
		return CheckpointArrivalResponse.from(arrival);
	}

	@Transactional
	public RoadExecutionResponse arriveAtDestination(UUID roadLegVehicleId) {
		RoadContext context = loadContext(roadLegVehicleId);
		requireAssignedActor(context.execution().getDriverId(), UserRole.DRIVER);
		if (context.execution().getStatus() == ExecutionStatus.DESTINATION
				|| context.execution().getStatus() == ExecutionStatus.COMPLETED) {
			return RoadExecutionResponse.from(context.execution());
		}
		ensureLegInProgress(context);
		if (context.execution().getStatus() != ExecutionStatus.IN_PROGRESS) {
			throw new ExecutionConflictException("Vehicle must be in progress before destination arrival");
		}
		requireWelfareForLastReachedCheckpoint(context, arrivalRepository
				.findAllByRoadVehicleExecutionId(context.execution().getId()));
		context.execution().arriveAtDestination(LocalDateTime.now(clock));
		RoadVehicleExecution updated = completeVehicleWhenReady(context);
		notificationService.createRoadFinalDestinationReached(context.customerId(),
				context.planOrderId(), context.execution().getId());
		return RoadExecutionResponse.from(updated);
	}

	@Transactional
	public WelfareEvidenceResponse recordCheckpointWelfare(UUID roadLegVehicleId, UUID checkpointId,
			MultipartFile photo, String note) {
		RoadContext context = loadContext(roadLegVehicleId);
		UUID actorId = requireAssignedActor(context.execution().getEscortId(), UserRole.ESCORT);
		var existing = welfareRepository.findByRoadVehicleExecutionIdAndCheckpointIdAndEventType(
				context.execution().getId(), checkpointId, WelfareEventType.CHECKPOINT);
		if (existing.isPresent()) return WelfareEvidenceResponse.from(existing.get());
		ensureLegInProgress(context);
		if (context.execution().getStatus() != ExecutionStatus.IN_PROGRESS
				&& context.execution().getStatus() != ExecutionStatus.DESTINATION) {
			throw new ExecutionConflictException("Vehicle is not at an active checkpoint");
		}
		Checkpoint checkpoint = checkpointRepository.findById(checkpointId)
				.orElseThrow(RoutePlanNotFoundException::new);
		if (!checkpoint.getRouteLegId().equals(context.leg().getId())
				|| arrivalRepository.findByRoadVehicleExecutionIdAndCheckpointId(
						context.execution().getId(), checkpointId).isEmpty()) {
			throw new ExecutionConflictException("Welfare evidence requires this Vehicle to have reached its checkpoint");
		}
		return saveWelfare(context, checkpointId, WelfareEventType.CHECKPOINT, photo, note, actorId);
	}

	@Transactional
	public WelfareEvidenceResponse recordFinalWelfare(UUID roadLegVehicleId, MultipartFile photo, String note) {
		RoadContext context = loadContext(roadLegVehicleId);
		UUID actorId = requireAssignedActor(context.execution().getEscortId(), UserRole.ESCORT);
		var existing = welfareRepository.findByRoadVehicleExecutionIdAndEventType(
				context.execution().getId(), WelfareEventType.FINAL_DESTINATION);
		if (existing.isPresent()) return WelfareEvidenceResponse.from(existing.get());
		ensureLegInProgress(context);
		if (context.execution().getStatus() != ExecutionStatus.DESTINATION) {
			throw new ExecutionConflictException("Final destination welfare requires Driver destination arrival");
		}
		return saveWelfare(context, null, WelfareEventType.FINAL_DESTINATION, photo, note, actorId);
	}

	private WelfareEvidenceResponse saveWelfare(RoadContext context, UUID checkpointId,
			WelfareEventType eventType, MultipartFile photo, String note, UUID actorId) {
		ValidatedPhoto validated = validatePhoto(photo, note);
		String publicId = "horse-transport/orders/" + context.planOrderId()
				+ "/route-legs/" + context.leg().getId() + "/vehicles/"
				+ context.roadVehicle().getId() + "/welfare/" + UUID.randomUUID();
		String photoUrl = storage.upload(validated.content(), validated.contentType(), publicId, false);
		registerDeleteOnRollback(publicId);
		if (photoUrl == null || photoUrl.isBlank() || photoUrl.length() > 500) {
			throw new DocumentStorageException("Stored welfare photo URL is invalid");
		}
		WelfareEvidence evidence = welfareRepository.saveAndFlush(new WelfareEvidence(
				context.execution().getId(), checkpointId, eventType, photoUrl, validated.note(),
				actorId, LocalDateTime.now(clock)));
		notificationService.createWelfareUpdated(context.customerId(), context.planOrderId(), evidence.getId());
		if (eventType == WelfareEventType.FINAL_DESTINATION) {
			completeVehicleWhenReady(context);
		}
		return WelfareEvidenceResponse.from(evidence);
	}

	private RoadVehicleExecution completeVehicleWhenReady(RoadContext context) {
		boolean hasFinalWelfare = welfareRepository.findByRoadVehicleExecutionIdAndEventType(
				context.execution().getId(), WelfareEventType.FINAL_DESTINATION).isPresent();
		if (context.execution().getStatus() == ExecutionStatus.DESTINATION && hasFinalWelfare) {
			context.execution().complete(LocalDateTime.now(clock));
			executionRepository.saveAndFlush(context.execution());
			List<RouteLeg> ordered = routeLegRepository
					.findAllByRoutePlanIdOrderBySequenceNoAsc(context.leg().getRoutePlanId());
			boolean finalLeg = !ordered.isEmpty() && ordered.get(ordered.size() - 1).getId().equals(context.leg().getId());
			if (!finalLeg) {
				coordinator.completeNonFinalLegWhenReady(context.leg().getId(), () -> {
					List<UUID> vehicleIds = roadVehicleRepository.findAllByRouteLegId(context.leg().getId())
							.stream().map(RoadLegVehicle::getId).toList();
					List<RoadVehicleExecution> executions = executionRepository
							.findAllByRoadLegVehicleIdIn(vehicleIds);
					return !vehicleIds.isEmpty() && executions.size() == vehicleIds.size()
							&& executions.stream().allMatch(item -> item.getStatus() == ExecutionStatus.COMPLETED);
				});
			}
		}
		return context.execution();
	}

	private RoadContext loadContext(UUID roadLegVehicleId) {
		RoadVehicleExecution execution = executionRepository.findByRoadLegVehicleIdForUpdate(roadLegVehicleId)
				.orElseThrow(RoutePlanNotFoundException::new);
		RoadLegVehicle roadVehicle = roadVehicleRepository.findById(roadLegVehicleId)
				.orElseThrow(RoutePlanNotFoundException::new);
		RouteLeg leg = routeLegRepository.findById(roadVehicle.getRouteLegId())
				.orElseThrow(RoutePlanNotFoundException::new);
		if (!execution.getRoadLegVehicleId().equals(roadVehicle.getId())
				|| !leg.getId().equals(roadVehicle.getRouteLegId())
				|| leg.getLegType() != RouteLegType.ROAD) {
			throw new RoutePlanValidationException("Execution does not belong to a ROAD RouteLeg");
		}
		RoutePlan plan = routePlanRepository.findById(leg.getRoutePlanId())
				.orElseThrow(RoutePlanNotFoundException::new);
		if (plan.getStatus() != RoutePlanStatus.APPROVED) {
			throw new ExecutionConflictException("Route Plan must be approved before execution");
		}
		TransportOrder order = orderRepository.findById(plan.getTransportOrderId())
				.orElseThrow(RoutePlanNotFoundException::new);
		return new RoadContext(roadVehicle, execution, leg, order.getId(), order.getCustomerId());
	}

	private void ensureLegInProgress(RoadContext context) {
		if (context.leg().getStatus() != RouteLegStatus.IN_PROGRESS) {
			throw new ExecutionConflictException("ROAD RouteLeg is not in progress");
		}
	}

	private void requireWelfareForLastReachedCheckpoint(RoadContext context,
			List<VehicleCheckpointArrival> arrivals) {
		if (arrivals.isEmpty()) return;
		Set<UUID> reachedCheckpointIds = new HashSet<>(arrivals.stream()
				.map(VehicleCheckpointArrival::getCheckpointId).toList());
		Checkpoint lastReached = checkpointRepository
				.findAllByRouteLegIdOrderBySequenceNoAsc(context.leg().getId()).stream()
				.filter(checkpoint -> reachedCheckpointIds.contains(checkpoint.getId()))
				.reduce((previous, current) -> current)
				.orElseThrow(() -> new RoutePlanValidationException("Checkpoint arrival is not on this RouteLeg"));
		boolean hasWelfare = welfareRepository.findByRoadVehicleExecutionIdAndCheckpointIdAndEventType(
				context.execution().getId(), lastReached.getId(), WelfareEventType.CHECKPOINT).isPresent();
		if (!hasWelfare) {
			throw new ExecutionConflictException("Escort welfare photo and note are required before Vehicle progression");
		}
	}

	private UUID requireAssignedActor(UUID assignedUserId, UserRole role) {
		UUID actorId = currentUserProvider.getCurrentUserId();
		UserAccount user = userRepository.findByIdForUpdate(actorId)
				.filter(account -> account.getStatus() == UserStatus.ACTIVE)
				.orElseThrow(() -> new AccessDeniedException("Only an assigned active execution staff member can act"));
		if (!actorId.equals(assignedUserId) || user.getRole() != role
				|| currentUserProvider.getCurrentUserRole() != role) {
			throw new AccessDeniedException("Only the assigned " + role + " can perform this ROAD action");
		}
		return actorId;
	}

	private ValidatedPhoto validatePhoto(MultipartFile file, String note) {
		if (file == null || file.isEmpty() || file.getSize() > MAX_PHOTO_SIZE) {
			throw new DocumentFileValidationException("A welfare photo up to 10 MB is required");
		}
		String contentType = file.getContentType();
		if (!PHOTO_TYPES.contains(contentType)) {
			throw new DocumentFileValidationException("Welfare photos must be JPEG or PNG images");
		}
		if (note == null || note.isBlank()) {
			throw new RoutePlanValidationException("A welfare note is required");
		}
		try {
			byte[] content = file.getBytes();
			if (!matchesImage(content, contentType)) {
				throw new DocumentFileValidationException("Welfare photo content does not match its MIME type");
			}
			return new ValidatedPhoto(content, contentType, note.trim());
		} catch (IOException exception) {
			throw new DocumentFileValidationException("Welfare photo could not be read");
		}
	}

	private boolean matchesImage(byte[] content, String contentType) {
		if (contentType.equals("image/jpeg")) {
			return content.length >= 3 && (content[0] & 255) == 0xFF
					&& (content[1] & 255) == 0xD8 && (content[2] & 255) == 0xFF;
		}
		byte[] signature = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
		if (content.length < signature.length) return false;
		for (int index = 0; index < signature.length; index++) {
			if (content[index] != signature[index]) return false;
		}
		return true;
	}

	private void registerDeleteOnRollback(String publicId) {
		if (!TransactionSynchronizationManager.isSynchronizationActive()) return;
		TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
			@Override
			public void afterCompletion(int status) {
				if (status == TransactionSynchronization.STATUS_ROLLED_BACK) {
					try {
						storage.delete(publicId);
					} catch (RuntimeException cleanupFailure) {
						LOGGER.warn("Could not remove welfare photo after database rollback", cleanupFailure);
					}
				}
			}
		});
	}

	private record RoadContext(RoadLegVehicle roadVehicle, RoadVehicleExecution execution,
			RouteLeg leg, UUID planOrderId, UUID customerId) { }
	private record ValidatedPhoto(byte[] content, String contentType, String note) { }
}
