package com.horsetransport.order;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/orders")
public class OrderStaffAssignmentController {
	private final OrderStaffAssignmentService assignmentService;

	public OrderStaffAssignmentController(OrderStaffAssignmentService assignmentService) {
		this.assignmentService = assignmentService;
	}

	@GetMapping("/assignment-inbox")
	public List<OrderAssignmentInboxResponse> inbox() {
		return assignmentService.findInbox();
	}

	@GetMapping("/{orderId}/assignment-candidates")
	public List<StaffCandidateResponse> candidates(@PathVariable UUID orderId, @RequestParam OrderStaffRole role) {
		return assignmentService.findCandidates(orderId, role);
	}

	@GetMapping("/{orderId}/staff-assignments")
	public List<OrderStaffAssignmentResponse> assignments(@PathVariable UUID orderId) {
		return assignmentService.findAssignments(orderId);
	}

	@PostMapping("/{orderId}/staff-assignments")
	@ResponseStatus(HttpStatus.CREATED)
	public List<OrderStaffAssignmentResponse> assign(@PathVariable UUID orderId,
			@Valid @RequestBody AssignOrderStaffRequest request) {
		return assignmentService.assign(orderId, request);
	}
}
