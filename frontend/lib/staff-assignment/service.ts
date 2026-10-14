import { apiStaffAssignmentService } from "./api-service";
import { mockStaffAssignmentService } from "./mock-service";
import type { StaffAssignmentService } from "./types";

export function getStaffAssignmentService(preview: boolean): StaffAssignmentService {
  return preview ? mockStaffAssignmentService : apiStaffAssignmentService;
}

export * from "./types";
