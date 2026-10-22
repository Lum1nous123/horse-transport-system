package com.horsetransport.route;

import java.io.IOException;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.horsetransport.document.DocumentFileValidationException;
import com.horsetransport.document.DocumentStorage;
import com.horsetransport.document.DocumentStorageException;
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
public class AirJourneyService {

	private static final Logger LOGGER = LoggerFactory.getLogger(AirJourneyService.class);
	private static final long MAX_PHOTO_SIZE = 10L * 1024 * 1024;
	private static final Set<String> PHOTO_TYPES = Set.of("image/jpeg", "image/png");

	private final AirLegExecutionRepository executionRepository;
	private final RouteLegRepository routeLegRepository;
	private final RoutePlanRepository routePlanRepository;
	private final WelfareEvidenceRepository welfareRepository;
	private final UserRepository userRepository;
	private final CurrentUserProvider currentUserProvider;
	private final RouteLegExecutionCoordinator coordinator;
	private final DocumentStorage storage;
	private final Clock clock;

	public AirJourneyService(AirLegExecutionRepository executionRepository,
			RouteLegRepository routeLegRepository, RoutePlanRepository routePlanRepository,
			WelfareEvidenceRepository welfareRepository, UserRepository userRepository,
			CurrentUserProvider currentUserProvider, RouteLegExecutionCoordinator coordinator,
			DocumentStorage storage, Clock clock) {
		this.executionRepository = executionRepository;
		this.routeLegRepository = routeLegRepository;
		this.routePlanRepository = routePlanRepository;
		this.welfareRepository = welfareRepository;
		this.userRepository = userRepository;
		this.currentUserProvider = currentUserProvider;
		this.coordinator = coordinator;
		this.storage = storage;
		this.clock = clock;
	}

	@Transactional
	public AirExecutionResponse start(UUID routeLegId) {
		AirContext context = loadContext(routeLegId);

		// Chỉ assigned active Escort được thao tác, kể cả khi request được gửi lại
		requireAssignedEscort(context.execution());
		if (context.execution().getStatus() != ExecutionStatus.NOT_STARTED) {
			return AirExecutionResponse.from(context.execution());
		}

		// BE-23 sở hữu quy tắc bắt đầu RouteLeg và TransportOrder
		coordinator.startCurrentLeg(context.leg().getId());
		context.execution().start(LocalDateTime.now(clock));
		return AirExecutionResponse.from(executionRepository.saveAndFlush(context.execution()));
	}

	@Transactional
	public AirExecutionResponse arriveAtDestination(UUID routeLegId) {
		AirContext context = loadContext(routeLegId);

		// Chỉ assigned active Escort được xác nhận chuyến AIR đã đến nơi
		requireAssignedEscort(context.execution());
		if (context.execution().getStatus() == ExecutionStatus.DESTINATION
				|| context.execution().getStatus() == ExecutionStatus.COMPLETED) {
			return AirExecutionResponse.from(context.execution());
		}
		if (context.leg().getStatus() != RouteLegStatus.IN_PROGRESS) {
			throw new RoutePlanValidationException("AIR RouteLeg is not in progress");
		}

		context.execution().arriveAtDestination(LocalDateTime.now(clock));
		return AirExecutionResponse.from(executionRepository.saveAndFlush(context.execution()));
	}

	@Transactional
	public WelfareEvidenceResponse recordFinalWelfare(UUID routeLegId, MultipartFile photo, String note) {
		AirContext context = loadContext(routeLegId);
		UUID actorId = requireAssignedEscort(context.execution());
		var existing = welfareRepository.findByAirLegExecutionIdAndEventType(
				context.execution().getId(), WelfareEventType.FINAL_DESTINATION);
		if (existing.isPresent()) {
			return WelfareEvidenceResponse.from(existing.get());
		}
		if (context.leg().getStatus() != RouteLegStatus.IN_PROGRESS) {
			throw new RoutePlanValidationException("AIR RouteLeg is not in progress");
		}
		if (context.execution().getStatus() != ExecutionStatus.DESTINATION) {
			throw new RoutePlanValidationException(
					"Final destination welfare requires Escort destination arrival");
		}

		ValidatedPhoto validated = validatePhoto(photo, note);
		String publicId = "horse-transport/orders/" + context.planOrderId()
				+ "/route-legs/" + context.leg().getId() + "/air/welfare/" + UUID.randomUUID();
		String photoUrl = storage.upload(validated.content(), validated.contentType(), publicId, false);
		registerDeleteOnRollback(publicId);
		if (photoUrl == null || photoUrl.isBlank() || photoUrl.length() > 500) {
			throw new DocumentStorageException("Stored welfare photo URL is invalid");
		}

		WelfareEvidence evidence = welfareRepository.saveAndFlush(new WelfareEvidence(
				context.execution().getId(), WelfareEventType.FINAL_DESTINATION, photoUrl,
				validated.note(), actorId, LocalDateTime.now(clock)));
		completeNonFinalExecution(context);
		return WelfareEvidenceResponse.from(evidence);
	}

	private void completeNonFinalExecution(AirContext context) {
		List<RouteLeg> orderedLegs = routeLegRepository
				.findAllByRoutePlanIdOrderBySequenceNoAsc(context.leg().getRoutePlanId());
		int currentIndex = -1;
		for (int index = 0; index < orderedLegs.size(); index++) {
			if (orderedLegs.get(index).getId().equals(context.leg().getId())) {
				currentIndex = index;
				break;
			}
		}
		if (currentIndex < 0) {
			throw new RoutePlanValidationException("AIR RouteLeg is not part of its ordered Route Plan");
		}

		// Final AIR dừng ở ranh giới PoD; BE-26 sẽ hoàn tất RouteLeg và Order
		if (currentIndex == orderedLegs.size() - 1) {
			return;
		}

		// Non-final AIR hoàn tất execution rồi giao BE-23 mở đúng leg kế tiếp
		context.execution().complete(LocalDateTime.now(clock));
		executionRepository.saveAndFlush(context.execution());
		coordinator.completeNonFinalLeg(context.leg().getId());
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
						LOGGER.warn("Could not remove AIR welfare photo after database rollback", cleanupFailure);
					}
				}
			}
		});
	}

	private AirContext loadContext(UUID routeLegId) {
		// Khóa AIR execution để các mutation đồng thời không làm sai tiến trình
		AirLegExecution execution = executionRepository.findByRouteLegIdForUpdate(routeLegId)
				.orElseThrow(RoutePlanNotFoundException::new);
		RouteLeg leg = routeLegRepository.findById(routeLegId)
				.orElseThrow(RoutePlanNotFoundException::new);
		if (!execution.getRouteLegId().equals(leg.getId()) || leg.getLegType() != RouteLegType.AIR) {
			throw new RoutePlanValidationException("Execution does not belong to an AIR RouteLeg");
		}
		RoutePlan plan = routePlanRepository.findById(leg.getRoutePlanId())
				.orElseThrow(RoutePlanNotFoundException::new);
		if (plan.getStatus() != RoutePlanStatus.APPROVED) {
			throw new RoutePlanValidationException("Route Plan must be approved before execution");
		}
		return new AirContext(execution, leg, plan.getTransportOrderId());
	}

	private UUID requireAssignedEscort(AirLegExecution execution) {
		UUID actorId = currentUserProvider.getCurrentUserId();
		UserAccount user = userRepository.findByIdForUpdate(actorId)
				.filter(account -> account.getStatus() == UserStatus.ACTIVE)
				.orElseThrow(() -> new AccessDeniedException(
						"Only an assigned active Escort can perform this AIR action"));
		if (!actorId.equals(execution.getEscortId()) || user.getRole() != UserRole.ESCORT
				|| currentUserProvider.getCurrentUserRole() != UserRole.ESCORT) {
			throw new AccessDeniedException("Only the assigned Escort can perform this AIR action");
		}
		return actorId;
	}

	private record AirContext(AirLegExecution execution, RouteLeg leg, UUID planOrderId) { }
	private record ValidatedPhoto(byte[] content, String contentType, String note) { }
}
