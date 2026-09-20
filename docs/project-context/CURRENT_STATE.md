# Horse Transport System — Current State

## Purpose

This file is a portable handoff and resume guide for a new Codex conversation or development environment. It summarizes the current project state; it is not an authoritative business-requirements source and must not override the approved requirements, workflow specification, Business Rules, or ERD.

## Current Phase

- Business discovery is complete.
- FR-001 through FR-020 passed Human Review.
- Architecture planning and requirement-to-data-model reconciliation have been performed.
- The revised MVP ERD has been implemented in `docs/erd/erd.dbml`.
- ERD hardening/review has minor non-blocking follow-ups remaining.
- GitHub backlog publishing has not started.
- Sprint planning has not started.
- Application implementation has not started.

## Authoritative Sources

- Approved Functional Requirements: `docs/requirements/Functional_Requirements_Proposed.docx`
- Confirmed Business Workflow Specification: `docs/requirements/Horse_Transport_System_Confirmed_Business_Workflow_Specification.docx`
- Business Rules: `docs/business-rules/Business_Rules.docx`
- Revised MVP ERD: `docs/erd/erd.dbml`

`CURRENT_STATE.md` only summarizes the project state. If it conflicts with an authoritative source, follow the source-priority and Human Approval Gate rules in `AGENTS.md` rather than treating this summary as a requirement.

## Approved Requirement State

- Requirements: FR-001 through FR-020
- Status: Approved
- Requirement Classification: Confirmed
- Business Open Questions: 0
- Human Review Gate: Passed

The Functional Requirements filename still contains `Proposed`, but the document contents explicitly record that FR-001 through FR-020 are approved.

## Key Confirmed MVP Decisions

- TransportOrder lifecycle: `DRAFT → SUBMITTED → QUOTATION_SENT → APPROVED → READY_TO_SHIP → IN_PROGRESS → DELIVERED`, with the approved `REJECTED` and `CANCELLED` exits. `DELIVERED`, `REJECTED`, and `CANCELLED` are terminal.
- A sent quotation is immutable and non-versioned. Successful Deposit payment is the Customer's quotation acceptance and automatically moves the Order to `APPROVED`.
- Every Horse receives the same fixed checklist: Horse Passport/Identification, Vaccination Certificate, Veterinary Health Certificate, Ownership Certificate, and Export/Import Permit.
- Only the Customer uploads/submits document versions. The assigned TS reviews them, approves or rejects with a reason, and explicitly performs Final Confirm after all required current versions are approved.
- One Document Completion Deadline applies to the Order. Missing or DRAFT documents at the deadline cause cancellation and a full Deposit refund; pending TS review does not. A post-deadline rejection causes immediate cancellation and refund.
- After Remaining Balance payment, the FRC creates an ordered ROAD/AIR Route Plan. The FRC submits it for LM review; LM may Confirm or Return with a reason. Confirmation permanently locks the Route Plan.
- Each Horse is allocated to exactly one Vehicle in every ROAD RouteLeg. Capacity is validated per Vehicle, and allocations may differ between ROAD legs.
- After route approval, the System assigns one Driver and one Escort to each ROAD Vehicle and one Escort to each AIR RouteLeg.
- RouteLegs execute strictly in sequence. ROAD Vehicles within one leg progress independently.
- ROAD checkpoint definitions belong to the RouteLeg and are shared; each Vehicle records its own checkpoint arrivals against that plan.
- The assigned Escort records Vehicle-specific ROAD welfare evidence or AIR-leg welfare evidence, including required final-destination evidence.
- A final ROAD leg requires separate Proof of Delivery for every Vehicle; a final AIR leg requires one Proof of Delivery for the leg. Recipient login, OTP, signature, or Customer receipt confirmation is not required.
- Tracking is milestone/checkpoint based. Customer-facing journey, payment, and refund notifications are in-app and system-generated.
- FR-020 audit scope is exactly `TRANSPORT_ORDER`, `TRANSPORT_ORDER_HORSE`, `HORSE_DOCUMENT_VERSION`, `ROUTE_LEG`, and `QUOTATION`. Each covered status transition and its audit record must commit atomically.

## Explicit MVP Non-Scope

- ChangeRequest
- Incident management
- GPS or live location
- Route optimization
- Airline API, booking, or verification
- Quotation negotiation, revision, or withdrawal
- Order reopening
- Partial Horse shipment
- Document Phase reopening
- Manual execution-staff assignment
- Mid-trip staff reassignment
- Recipient account, OTP, or electronic signature
- Partial refunds
- Currency conversion

## Architecture / ERD State

`docs/erd/erd.dbml` represents the revised MVP data model. It currently contains 27 tables and 22 enums. ChangeRequest and Incident structures are excluded.

The status-audit entity scope is exactly:

- `TRANSPORT_ORDER`
- `TRANSPORT_ORDER_HORSE`
- `HORSE_DOCUMENT_VERSION`
- `ROUTE_LEG`
- `QUOTATION`

The following architecture-hardening follow-ups are **NON-BLOCKING**:

1. Make DRAFT versus SENT quotation arithmetic and nullability semantics explicit.
2. Review the semantics of `order_staff_assignments.assigned_by` so it does not accidentally introduce an unapproved TS/FRC assignment workflow.
3. Clarify the final status-audit comment so LM RoutePlan return is not incorrectly implied to be part of the FR-020 audit scope.

These follow-ups do not change approved requirements and must not be used to infer new business behavior.

## GitHub Project State

- Repository: `Lum1nous123/horse-transport-system`
- Project: `Horse Transport System (#4)`
- Workflow: `Backlog → Ready → In Progress → In Review → Done`
- Custom planning fields configured: `Priority`, `Complexity`
- Approved FRs have not been published as GitHub Issues.
- The GitHub Project currently has no backlog items.
- Sprint/Iteration has not been assigned.
- The Senior BA must not assign Sprint.

## Agent Responsibilities

- **Senior BA:** maintain requirement clarity and publish the approved FR backlog when explicitly requested and permitted by the Human Approval Gate.
- **Solution Architect:** maintain architecture and the data model in alignment with approved behavior.
- **Scrum Master:** perform Sprint Planning and manage Sprint assignment after the required approval.
- **Implementation agents:** implement only approved requirements and architecture, then verify the applicable Acceptance Criteria.

## Current Work

### COMPLETED

- Business discovery
- Requirement clarification
- FR-001 through FR-020 Human Review
- Revised MVP ERD implementation

### DEFERRED / NON-BLOCKING

- ERD hardening items documented in the Architecture / ERD State section

### NEXT

1. Preserve the current project state in Git.
2. Prepare and publish the approved FR backlog through the Senior BA workflow after an explicit publishing request and all required safety checks.

### NOT STARTED

- GitHub Issue publishing
- Sprint planning
- Backend implementation
- Frontend implementation
- QA execution

## Resume Protocol

For a fresh Codex conversation:

1. Read `AGENTS.md`.
2. Read `docs/project-context/CURRENT_STATE.md`.
3. Read the skill for the role being used.
4. Read only the authoritative source documents needed for the task.
5. Run `git status` and inspect recent commits before modifying files.
6. Resume from the Current Work section.
7. Do not reopen confirmed business decisions unless an authoritative source contains a real contradiction.
8. Do not infer requirements from previous chat history.
9. Do not perform side effects requiring a Human Review Gate without explicit approval.

## Update Protocol

Update this file after major milestones such as requirements approval, architecture approval, backlog publication, Sprint Planning, or major implementation progress.

- Keep it concise and focused on resumable current state.
- Do not turn it into a changelog.
- Do not duplicate the complete requirements.
- Do not introduce new business rules.
- Re-verify claims against authoritative sources and current repository/external state before updating them.
