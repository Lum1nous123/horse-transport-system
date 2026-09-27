# Horse Transport System — Current State

## Purpose

This file is a portable handoff and resume guide for a new Codex conversation or development environment. It summarizes the current project state; it is not an authoritative business-requirements source and must not override the approved requirements, workflow specification, Business Rules, or ERD.

## Current Phase

- Business discovery is complete.
- FR-001 through FR-020 passed Human Review.
- Architecture planning and requirement-to-data-model reconciliation have been performed.
- The revised MVP ERD has been implemented in `docs/erd/erd.dbml`.
- ERD hardening/review has minor non-blocking follow-ups remaining.
- GitHub backlog publishing is complete and verified.
- Scrum planning / Sprint planning is complete and Human Review approved.
- GitHub Project #4 has three two-week Development Sprint iterations for course Weeks 4–9, and FR-001 through FR-020 are assigned according to the instructor-required, Human-Approved reforecast.
- Course Week 10 is reserved for presentation, final demo, final bug fixing, and release stabilization; it is not a feature-development iteration.
- Backend implementation is active. BE-01, JWT Authentication foundation, BE-02, BE-03, and BE-04 are complete and merged into `main`.

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
- Iteration field configured: `Sprint`
- FR-001 through FR-020 are Approved and Confirmed, with no unresolved business Open Questions.
- All 20 approved FRs are published as GitHub Issues #1 through #20.
- All 20 Issues are added to Project #4 and verified as Project items.
- Every Project item has Status `Backlog`; Priority and Complexity are assigned and verified.
- Reforecast Sprint assignments are configured and verified:
  - Sprint 1 / Weeks 4–5 (`2026-09-28` through `2026-10-11`): FR-001 through FR-007
  - Sprint 2 / Weeks 6–7 (`2026-10-12` through `2026-10-25`): FR-008 through FR-014
  - Sprint 3 / Weeks 8–9 (`2026-10-26` through `2026-11-08`): FR-015 through FR-020
- Sprint 1 execution structure is published and verified with 22 implementation sub-issues, each linked directly to its parent FR, added to Project #4, assigned to `Sprint 1 (Weeks 4-5)`, and set to `Backlog`:
  - Backend: Issues #21–#29, assigned to `Lum1nous123`
  - Frontend: Issues #30–#34, assigned to `ntnphat20`
  - QA/Test: Issues #35–#39, assigned to `DuongTran007`
  - Leader/Review: Issues #40–#42, assigned to `baoanh-code`
- Week 10 (`2026-11-09` through `2026-11-15`) is reserved for presentation, final demo, final bug fixing, and release stabilization. It is not configured as a Development Sprint.
- The Senior BA must not assign Sprint.
- Senior BA publication work is complete unless requirements change or clarification is requested.

## Agent Responsibilities

- **Senior BA:** maintain requirement clarity and publish the approved FR backlog when explicitly requested and permitted by the Human Approval Gate.
- **Solution Architect:** maintain architecture and the data model in alignment with approved behavior.
- **Scrum Master:** perform Sprint Planning and manage Sprint assignment after the required approval.
- **Implementation agents:** implement only approved requirements and architecture, then verify the applicable Acceptance Criteria.

## Current Work

PR #43 (BE-01 + JWT Authentication foundation), PR #44 (BE-02 Order
Draft-to-Submit), PR #45 (BE-03 Cancel / Reject Pre-Approval), and PR #46
(BE-04 Quotation Draft-to-Sent) are merged into `main`. The latest merge is
commit `7d46c9b`.

BE-04 implements Quotation create DRAFT, edit DRAFT, LM get, and atomic send
from DRAFT to SENT. Send also moves the Order from `SUBMITTED` to
`QUOTATION_SENT` and writes `QUOTATION` plus `TRANSPORT_ORDER` status audits in
the same transaction. LM can create/edit/get/send; a Customer can only view a
SENT quotation belonging to their own Order. SENT quotations are immutable.

The backend calculates `totalAmount` and `remainingAmount`, uses fixed currency
`USD`, and stores `depositAmount` on the quotation. Deposit payment is not yet
implemented. There is no Customer Accept Quotation action and no LM manual
approval; successful Deposit payment will move `QUOTATION_SENT` to `APPROVED`
in BE-05.

The full backend suite has 90 passing tests after BE-04. BE-04 reused V1 and did
not change the ERD, migration, or frontend.

Next backend task: BE-05 Pay Deposit and Approve Order.

### COMPLETED

- Business discovery
- Requirement clarification
- FR-001 through FR-020 Human Review
- Revised MVP ERD implementation
- GitHub publication of FR-001 through FR-020, verified with 20/20 Issues and 20/20 Project items
- Sprint Planning Human Review and approval
- Initial GitHub Sprint field configuration and assignment of FR-001 through FR-020 across six one-week Development Sprints
- Human-Approved reforecast to three two-week Development Sprints, with 20/20 Project item assignments verified
- GitHub publication and verification of 22 Sprint 1 implementation sub-issues (#21–#42), including direct parent linkage, role-based assignees, Project #4 membership, Sprint assignment, and `Backlog` status
- BE-01 Horse Identity
- JWT Authentication foundation
- BE-02 Order Draft-to-Submit
- BE-03 Cancel / Reject Pre-Approval
- BE-04 Quotation Draft-to-Sent / FR-004 implementation, merged through PR #46

### DEFERRED / NON-BLOCKING

- ERD hardening items documented in the Architecture / ERD State section

### NEXT

1. Implement BE-05 Pay Deposit and Approve Order.
2. Keep Stripe payment and automatic `QUOTATION_SENT → APPROVED` transition within BE-05 scope.

### NOT STARTED

- BE-05 and later backend vertical slices
- Stripe Deposit payment and `QUOTATION_SENT → APPROVED`
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

