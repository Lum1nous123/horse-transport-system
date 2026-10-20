# Sprint 3 transactional audit coverage

This is an implementation evidence tracker for issue #110. Audit scope remains
the five entity types in BR-22: `TRANSPORT_ORDER`, `TRANSPORT_ORDER_HORSE`,
`HORSE_DOCUMENT_VERSION`, `ROUTE_LEG`, and `QUOTATION`.

## Foundation contract

`StatusAuditRecorder` is the shared write API for covered status transitions.
Feature services call it inside their existing business transaction. Its
`MANDATORY` propagation rejects calls without that transaction, and
`saveAndFlush` makes an audit persistence failure fail the business operation
before it returns. Use `recordUserTransition` for user actions and
`recordSystemTransition` for system actions. Reasons are passed only when the
confirmed workflow requires them. Audit records capture entity, entity ID,
old/new status, actor, timestamp, and optional reason. The enum constrains the
entity scope; same-status records are rejected.

## Coverage matrix

| Transition / flow | Entity | Evidence | Status |
|---|---|---|---|
| Route Plan approval moves Order `APPROVED → READY_TO_SHIP` after execution staffing succeeds | `TRANSPORT_ORDER` | `RoutePlanServiceTest` verifies audit invocation; operation is transactional | Implemented locally; focused tests pass |
| LM confirmation opens first RouteLeg `PLANNED → READY` | `ROUTE_LEG` | `RoutePlanServiceTest` verifies persisted state and audit invocation | Implemented locally; focused tests pass |
| First assigned execution staff member starts first RouteLeg; Order `READY_TO_SHIP → IN_PROGRESS` and leg `READY → IN_PROGRESS` | `TRANSPORT_ORDER`, `ROUTE_LEG` | `RouteLegExecutionCoordinatorTest` verifies actor attribution, state and audit API calls | Implemented locally; focused tests pass |
| Assigned execution staff completes a non-final RouteLeg and opens exactly the next leg `PLANNED → READY` | `ROUTE_LEG` | `RouteLegExecutionCoordinatorTest` verifies both transitions and audit API calls | Implemented locally; focused tests pass |
| Independent ROAD Vehicle starts; first start changes Order/RouteLeg and later Vehicle starts add no duplicate RouteLeg transition | `TRANSPORT_ORDER`, `ROUTE_LEG` | `RoadJourneyServiceTest` calls shared coordinator; `RouteLegExecutionCoordinatorTest` verifies first/other-vehicle starts | Implemented locally; focused tests pass |
| Non-final ROAD RouteLeg transition occurs only after every allocated Vehicle execution is complete | `ROUTE_LEG` | `RoadJourneyServiceTest` verifies destination + final welfare completion and invokes the locked aggregate readiness callback | Implemented locally; focused tests pass |
| ROAD checkpoint arrival and welfare evidence for an assigned Vehicle | No additional status entity | `RoadJourneyServiceTest` verifies per-execution checkpoint arrivals, reached-checkpoint welfare gating, final welfare and role checks | Implemented locally; these data changes are outside BR-22 status-audit scope |
| Sprint 3 Order transition to `DELIVERED` | `TRANSPORT_ORDER` | Implemented by BE-26 final handover flow | Pending feature implementation/integration |
| Mode-specific ROAD eligibility and completion prerequisites | `ROUTE_LEG` | Enforced by BE-24 before invoking the coordinator | Implemented locally; focused tests pass |
| Mode-specific AIR eligibility and completion prerequisites | `ROUTE_LEG` | Enforced by BE-25 before invoking the coordinator | Pending feature implementation/integration |
| Final delivery transition to `DELIVERED` | `TRANSPORT_ORDER` | Implemented by BE-26 feature owner when present | Pending feature implementation/integration |
| Rollback on PostgreSQL when audit insertion fails | Covered entity | Requires transactional database integration evidence | Pending PostgreSQL-capable integration run |
| Retry/idempotency for each downstream transition | Covered entity | Requires feature-level retry evidence | Pending feature implementation/integration |

BE-23 provides shared sequence policy; mode handlers still own their
mode-specific completion prerequisites. Route Plan approval/return status is
not itself in BR-22's audit scope. Vehicle execution statuses and other
non-status data changes are also outside the audit scope.

## Verification notes

- The backend sources and tests compile (`sh mvnw -DskipTests test`).
- Focused ROAD/coordinator and BE-21/audit tests pass when run outside the
  sandbox: `RoadJourneyServiceTest` + `RouteLegExecutionCoordinatorTest` (14
  tests), and `RoutePlanServiceTest` + `StatusAuditRecorderTest` (23 tests).
- `BackendApplicationTests` passes with the new service/repository beans.
- PostgreSQL Hibernate validation was attempted, but Testcontainers could not
  find a Docker environment; persisted PostgreSQL behavior remains unverified.
- PostgreSQL rollback evidence and downstream ROAD/AIR/PoD/delivery evidence
  remain necessary before issue #110 can meet its closure gate.
