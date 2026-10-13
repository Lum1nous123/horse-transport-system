import { mockStaffAssignmentService } from "./mock-service";
import type { StaffAssignmentService } from "./types";

// BE-10 is not contracted yet. Pages depend only on this interface so a real
// adapter can replace the mock without leaking guessed endpoints into the UI.
export const staffAssignmentService: StaffAssignmentService = mockStaffAssignmentService;

export * from "./types";
