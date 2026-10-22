package com.horsetransport.delivery;

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
import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.TransportOrder;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.route.AirLegExecution;
import com.horsetransport.route.AirLegExecutionRepository;
import com.horsetransport.route.ExecutionStatus;
import com.horsetransport.route.RoadLegVehicle;
import com.horsetransport.route.RoadLegVehicleHorseRepository;
import com.horsetransport.route.RoadLegVehicleRepository;
import com.horsetransport.route.RoadVehicleExecution;
import com.horsetransport.route.RoadVehicleExecutionRepository;
import com.horsetransport.route.RouteLeg;
import com.horsetransport.route.RouteLegExecutionCoordinator;
import com.horsetransport.route.RouteLegRepository;
import com.horsetransport.route.RouteLegStatus;
import com.horsetransport.route.RouteLegType;
import com.horsetransport.route.RoutePlan;
import com.horsetransport.route.RoutePlanNotFoundException;
import com.horsetransport.route.RoutePlanRepository;
import com.horsetransport.route.RoutePlanStatus;
import com.horsetransport.route.RoutePlanValidationException;
import com.horsetransport.route.WelfareEventType;
import com.horsetransport.route.WelfareEvidence;
import com.horsetransport.route.WelfareEvidenceRepository;
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
public class FinalHandoverService {

	private static final Logger LOGGER = LoggerFactory.getLogger(FinalHandoverService.class);
	private static final long MAX_PHOTO_SIZE = 10L * 1024 * 1024;
	private static final Set<String> PHOTO_TYPES = Set.of("image/jpeg", "image/png");

	private final ProofOfDeliveryRepository proofRepository;
	private final RoadLegVehicleRepository roadVehicleRepository;
	private final RoadLegVehicleHorseRepository roadHorseRepository;
	private final RoadVehicleExecutionRepository roadExecutionRepository;
	private final AirLegExecutionRepository airExecutionRepository;
	private final RouteLegRepository routeLegRepository;
	private final RoutePlanRepository routePlanRepository;
	private final TransportOrderRepository orderRepository;
	private final WelfareEvidenceRepository welfareRepository;
	private final UserRepository userRepository;
	private final CurrentUserProvider currentUserProvider;
	private final RouteLegExecutionCoordinator coordinator;
	private final DocumentStorage storage;
	private final Clock clock;

	public FinalHandoverService(ProofOfDeliveryRepository proofRepository,
			RoadLegVehicleRepository roadVehicleRepository,
			RoadLegVehicleHorseRepository roadHorseRepository,
			RoadVehicleExecutionRepository roadExecutionRepository,
			AirLegExecutionRepository airExecutionRepository,
			RouteLegRepository routeLegRepository, RoutePlanRepository routePlanRepository,
			TransportOrderRepository orderRepository, WelfareEvidenceRepository welfareRepository,
			UserRepository userRepository, CurrentUserProvider currentUserProvider,
			RouteLegExecutionCoordinator coordinator, DocumentStorage storage, Clock clock) {
		this.proofRepository = proofRepository;
		this.roadVehicleRepository = roadVehicleRepository;
		this.roadHorseRepository = roadHorseRepository;
		this.roadExecutionRepository = roadExecutionRepository;
		this.airExecutionRepository = airExecutionRepository;
		this.routeLegRepository = routeLegRepository;
		this.routePlanRepository = routePlanRepository;
		this.orderRepository = orderRepository;
		this.welfareRepository = welfareRepository;
		this.userRepository = userRepository;
		this.currentUserProvider = currentUserProvider;
		this.coordinator = coordinator;
		this.storage = storage;
		this.clock = clock;
	}

	@Transactional
	public ProofOfDeliveryResponse recordRoadHandover(UUID roadLegVehicleId, String recipientName,
			MultipartFile photo, String note) {
		RoadContext context = loadRoadContext(roadLegVehicleId);
		UUID actorId = requireAssignedEscort(context.execution().getEscortId());
		var existing = proofRepository.findByRoadVehicleExecutionId(context.execution().getId());
		if (existing.isPresent()) return roadResponse(context, existing.get());

		requireFinalHandoverState(context.leg(), context.plan(), context.order(), RouteLegType.ROAD);
		// BE-24 publishes ROAD readiness through this persisted execution state.
		if (context.execution().getStatus() != ExecutionStatus.COMPLETED) {
			throw new RoutePlanValidationException(
					"ROAD handover requires destination arrival and final welfare completion");
		}
		WelfareEvidence welfare = welfareRepository.findByRoadVehicleExecutionIdAndEventType(
				context.execution().getId(), WelfareEventType.FINAL_DESTINATION)
				.orElseThrow(() -> new RoutePlanValidationException(
						"ROAD handover requires final destination welfare"));
		List<UUID> horseIds = roadHorseIds(context.leg().getId(), roadLegVehicleId);
		if (horseIds.isEmpty()) {
			throw new RoutePlanValidationException("ROAD handover requires transported Horses for this Vehicle");
		}

		ValidatedProof validated = validateProof(recipientName, photo, note);
		String publicId = "horse-transport/orders/" + context.order().getId()
				+ "/route-legs/" + context.leg().getId() + "/vehicles/"
				+ roadLegVehicleId + "/proof-of-delivery/" + UUID.randomUUID();
		String photoUrl = uploadProof(validated, publicId, welfare.getPhotoUrl());
		ProofOfDelivery proof = proofRepository.saveAndFlush(ProofOfDelivery.forRoad(
				context.execution().getId(), validated.recipientName(), photoUrl,
				validated.note(), actorId, LocalDateTime.now(clock)));

		coordinator.completeFinalLegWhenReady(context.leg().getId(),
				() -> roadDeliveryReady(context.leg().getId()));
		return roadResponse(context, proof);
	}

	@Transactional
	public ProofOfDeliveryResponse recordAirHandover(UUID routeLegId, String recipientName,
			MultipartFile photo, String note) {
		AirContext context = loadAirContext(routeLegId);
		UUID actorId = requireAssignedEscort(context.execution().getEscortId());
		var existing = proofRepository.findByAirLegExecutionId(context.execution().getId());
		if (existing.isPresent()) return airResponse(context, existing.get());

		requireFinalHandoverState(context.leg(), context.plan(), context.order(), RouteLegType.AIR);
		if (context.execution().getStatus() != ExecutionStatus.DESTINATION) {
			throw new RoutePlanValidationException("AIR handover requires destination arrival");
		}
		WelfareEvidence welfare = welfareRepository.findByAirLegExecutionIdAndEventType(
				context.execution().getId(), WelfareEventType.FINAL_DESTINATION)
				.orElseThrow(() -> new RoutePlanValidationException(
						"AIR handover requires final destination welfare"));

		ValidatedProof validated = validateProof(recipientName, photo, note);
		String publicId = "horse-transport/orders/" + context.order().getId()
				+ "/route-legs/" + context.leg().getId()
				+ "/air/proof-of-delivery/" + UUID.randomUUID();
		String photoUrl = uploadProof(validated, publicId, welfare.getPhotoUrl());
		ProofOfDelivery proof = proofRepository.saveAndFlush(ProofOfDelivery.forAir(
				context.execution().getId(), validated.recipientName(), photoUrl,
				validated.note(), actorId, LocalDateTime.now(clock)));

		context.execution().complete(LocalDateTime.now(clock));
		airExecutionRepository.saveAndFlush(context.execution());
		coordinator.completeFinalLegWhenReady(context.leg().getId(),
				() -> proofRepository.findByAirLegExecutionId(context.execution().getId()).isPresent());
		return airResponse(context, proof);
	}

	private RoadContext loadRoadContext(UUID roadLegVehicleId) {
		RoadVehicleExecution execution = roadExecutionRepository
				.findByRoadLegVehicleIdForUpdate(roadLegVehicleId)
				.orElseThrow(RoutePlanNotFoundException::new);
		RoadLegVehicle roadVehicle = roadVehicleRepository.findById(roadLegVehicleId)
				.orElseThrow(RoutePlanNotFoundException::new);
		RouteLeg leg = routeLegRepository.findById(roadVehicle.getRouteLegId())
				.orElseThrow(RoutePlanNotFoundException::new);
		RoutePlan plan = routePlanRepository.findById(leg.getRoutePlanId())
				.orElseThrow(RoutePlanNotFoundException::new);
		TransportOrder order = orderRepository.findById(plan.getTransportOrderId())
				.orElseThrow(RoutePlanNotFoundException::new);
		if (!execution.getRoadLegVehicleId().equals(roadVehicle.getId())) {
			throw new RoutePlanValidationException("Execution does not belong to this ROAD Vehicle");
		}
		return new RoadContext(roadVehicle, execution, leg, plan, order);
	}

	private AirContext loadAirContext(UUID routeLegId) {
		AirLegExecution execution = airExecutionRepository.findByRouteLegIdForUpdate(routeLegId)
				.orElseThrow(RoutePlanNotFoundException::new);
		RouteLeg leg = routeLegRepository.findById(routeLegId)
				.orElseThrow(RoutePlanNotFoundException::new);
		RoutePlan plan = routePlanRepository.findById(leg.getRoutePlanId())
				.orElseThrow(RoutePlanNotFoundException::new);
		TransportOrder order = orderRepository.findById(plan.getTransportOrderId())
				.orElseThrow(RoutePlanNotFoundException::new);
		if (!execution.getRouteLegId().equals(leg.getId())) {
			throw new RoutePlanValidationException("Execution does not belong to this AIR RouteLeg");
		}
		return new AirContext(execution, leg, plan, order);
	}

	private void requireFinalHandoverState(RouteLeg leg, RoutePlan plan, TransportOrder order,
			RouteLegType expectedType) {
		if (leg.getLegType() != expectedType || plan.getStatus() != RoutePlanStatus.APPROVED) {
			throw new RoutePlanValidationException("Final handover requires the approved matching RouteLeg type");
		}
		List<RouteLeg> ordered = routeLegRepository
				.findAllByRoutePlanIdOrderBySequenceNoAsc(plan.getId());
		if (ordered.isEmpty() || !ordered.get(ordered.size() - 1).getId().equals(leg.getId())) {
			throw new RoutePlanValidationException("Proof of Delivery is allowed only on the final RouteLeg");
		}
		if (leg.getStatus() != RouteLegStatus.IN_PROGRESS || order.getStatus() != OrderStatus.IN_PROGRESS) {
			throw new RoutePlanValidationException("Final handover requires an in-progress RouteLeg and Order");
		}
	}

	private UUID requireAssignedEscort(UUID assignedEscortId) {
		UUID actorId = currentUserProvider.getCurrentUserId();
		UserAccount actor = userRepository.findByIdForUpdate(actorId)
				.filter(user -> user.getStatus() == UserStatus.ACTIVE)
				.orElseThrow(() -> new AccessDeniedException(
						"Only an assigned active Escort can record final handover"));
		if (!actorId.equals(assignedEscortId) || actor.getRole() != UserRole.ESCORT
				|| currentUserProvider.getCurrentUserRole() != UserRole.ESCORT) {
			throw new AccessDeniedException("Only the assigned Escort can record final handover");
		}
		return actorId;
	}

	private boolean roadDeliveryReady(UUID routeLegId) {
		List<UUID> vehicleIds = roadVehicleRepository.findAllByRouteLegId(routeLegId).stream()
				.map(RoadLegVehicle::getId).toList();
		if (vehicleIds.isEmpty()) return false;
		List<RoadVehicleExecution> executions = roadExecutionRepository
				.findAllByRoadLegVehicleIdIn(vehicleIds);
		if (executions.size() != vehicleIds.size()
				|| executions.stream().anyMatch(item -> item.getStatus() != ExecutionStatus.COMPLETED)) {
			return false;
		}
		Set<UUID> executionIds = new HashSet<>(executions.stream()
				.map(RoadVehicleExecution::getId).toList());
		Set<UUID> handedOverExecutionIds = new HashSet<>(proofRepository
				.findAllByRoadVehicleExecutionIdIn(executionIds).stream()
				.map(ProofOfDelivery::getRoadVehicleExecutionId).toList());
		return handedOverExecutionIds.equals(executionIds);
	}

	private List<UUID> roadHorseIds(UUID routeLegId, UUID roadLegVehicleId) {
		return roadHorseRepository.findAllByRouteLegId(routeLegId).stream()
				.filter(allocation -> allocation.getRoadLegVehicleId().equals(roadLegVehicleId))
				.map(allocation -> allocation.getTransportOrderHorseId())
				.sorted()
				.toList();
	}

	private ProofOfDeliveryResponse roadResponse(RoadContext context, ProofOfDelivery proof) {
		List<UUID> vehicleIds = roadVehicleRepository.findAllByRouteLegId(context.leg().getId()).stream()
				.map(RoadLegVehicle::getId).toList();
		List<RoadVehicleExecution> executions = roadExecutionRepository
				.findAllByRoadLegVehicleIdIn(vehicleIds);
		List<UUID> executionIds = executions.stream().map(RoadVehicleExecution::getId).toList();
		int completed = proofRepository.findAllByRoadVehicleExecutionIdIn(executionIds).size();
		return response(proof, context.leg().getId(),
				roadHorseIds(context.leg().getId(), context.roadVehicle().getId()), completed,
				vehicleIds.size(), currentLegStatus(context.leg().getId()),
				currentOrderStatus(context.order().getId()));
	}

	private ProofOfDeliveryResponse airResponse(AirContext context, ProofOfDelivery proof) {
		List<UUID> horseIds = context.order().getHorses().stream()
				.map(orderHorse -> orderHorse.getId()).sorted().toList();
		return response(proof, context.leg().getId(), horseIds, 1, 1,
				currentLegStatus(context.leg().getId()), currentOrderStatus(context.order().getId()));
	}

	private ProofOfDeliveryResponse response(ProofOfDelivery proof, UUID routeLegId,
			List<UUID> horseIds, int completed, int required, RouteLegStatus legStatus,
			OrderStatus orderStatus) {
		return new ProofOfDeliveryResponse(proof.getId(), proof.getRoadVehicleExecutionId(),
				proof.getAirLegExecutionId(), routeLegId, horseIds, proof.getRecipientName(),
				proof.getProofPhotoUrl(), proof.getHandoverNote(), proof.getConfirmedByEscortId(),
				proof.getDeliveredAt(), proof.getCreatedAt(), completed, required, legStatus, orderStatus);
	}

	private RouteLegStatus currentLegStatus(UUID routeLegId) {
		return routeLegRepository.findById(routeLegId).orElseThrow(RoutePlanNotFoundException::new).getStatus();
	}

	private OrderStatus currentOrderStatus(UUID orderId) {
		return orderRepository.findById(orderId).orElseThrow(RoutePlanNotFoundException::new).getStatus();
	}

	private ValidatedProof validateProof(String recipientName, MultipartFile photo, String note) {
		if (recipientName == null || recipientName.isBlank() || recipientName.trim().length() > 150) {
			throw new RoutePlanValidationException("Recipient name is required and must not exceed 150 characters");
		}
		if (photo == null || photo.isEmpty() || photo.getSize() > MAX_PHOTO_SIZE) {
			throw new DocumentFileValidationException("A Proof of Delivery photo up to 10 MB is required");
		}
		String contentType = photo.getContentType();
		if (!PHOTO_TYPES.contains(contentType)) {
			throw new DocumentFileValidationException("Proof of Delivery photo must be JPEG or PNG");
		}
		try {
			byte[] content = photo.getBytes();
			if (!matchesImage(content, contentType)) {
				throw new DocumentFileValidationException(
						"Proof of Delivery photo content does not match its MIME type");
			}
			return new ValidatedProof(recipientName.trim(), content, contentType,
					note == null || note.isBlank() ? null : note.trim());
		}
		catch (IOException exception) {
			throw new DocumentFileValidationException("Proof of Delivery photo could not be read");
		}
	}

	private String uploadProof(ValidatedProof proof, String publicId, String welfarePhotoUrl) {
		String photoUrl = storage.upload(proof.content(), proof.contentType(), publicId, false);
		registerDeleteOnRollback(publicId);
		if (photoUrl == null || photoUrl.isBlank() || photoUrl.length() > 500) {
			throw new DocumentStorageException("Stored Proof of Delivery photo URL is invalid");
		}
		if (photoUrl.equals(welfarePhotoUrl)) {
			throw new RoutePlanValidationException(
					"Proof of Delivery photo must be distinct from final welfare photo");
		}
		return photoUrl;
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
					}
					catch (RuntimeException cleanupFailure) {
						LOGGER.warn("Could not remove Proof of Delivery photo after database rollback", cleanupFailure);
					}
				}
			}
		});
	}

	private record RoadContext(RoadLegVehicle roadVehicle, RoadVehicleExecution execution,
			RouteLeg leg, RoutePlan plan, TransportOrder order) { }
	private record AirContext(AirLegExecution execution, RouteLeg leg,
			RoutePlan plan, TransportOrder order) { }
	private record ValidatedProof(String recipientName, byte[] content,
			String contentType, String note) { }
}
