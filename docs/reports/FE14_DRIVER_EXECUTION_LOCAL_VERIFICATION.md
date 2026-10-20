# FE-14 Driver execution — local verification evidence

Date: 2026-10-20 (Asia/Bangkok)

Scope: issue #116, FR-015 and the Driver portion of FR-016. Evidence is local and
prepared for QA-13 review; it has not been posted to GitHub or submitted as QA
approval. Changes are uncommitted in the current working tree by user request.

## Implemented locally

- User-approved initial workspace and separate route/check-in view after Start.
- ACTIVE DRIVER access and login navigation.
- Assigned-only display and ownership checks on direct detail reads.
- Vehicle-scoped Start, checkpoint arrival, and destination arrival.
- Server-read-back control flow, double-submit protection, stale response
  protection, and actionable reconciliation errors.
- Read-only future-leg sequence; no Lead Driver or manual leg unlocking.
- Shared checkpoint definitions and Vehicle-specific arrival display.
- Destination recorded without inferring Vehicle, leg, or Order completion.
- Responsive desktop/mobile UI and a static ordinal route schematic.

## Verification commands and evidence

| Check | Evidence | Scope |
|---|---|---|
| `npm test` | PASS — 37 tests, 4 files | Local view models and behavioral simulation |
| `npm run lint` | PASS — ESLint | Entire frontend |
| `npm run build` | PASS — Next production compilation, type check, route generation | Entire frontend |
| `npm run test:ui` | PASS — 10 tests (5 desktop + 5 mobile), Chrome | Local dev preview; not real backend |

Browser suite covers complete Start → checkpoint 1 → checkpoint 2 → destination,
wrong-assignment denial, non-current-leg denial, additional Driver Start, and
zero-checkpoint destination flow. It checks that there is no schematic before
Start, no JavaScript error in the primary flow, no horizontal overflow at the end,
and the mobile check-in panel does not obscure the schematic. Full-page before/
after screenshots are saved in `frontend/test-results/` and visually inspected.

The component suite additionally covers unconfirmed mutation/read-back failure,
inconsistent Start state, duplicate clicks, stale errors, late responses,
production preview rejection, and inactive/wrong-role access.

## Outstanding integration / closure evidence

**Status: NOT DONE.** BE-23/BE-24 concrete API contracts are not present in the
inspected sources. GitHub issues #111/#112 define behavior but publish no HTTP
endpoint/DTO/error contract. No concrete execution endpoint is guessed.

| Gate | Result |
|---|---|
| Frozen endpoint/DTO/error contract mapping | BLOCKED: contract publication needed |
| BE-21 actual first RouteLeg READY | NOT VERIFIED locally |
| First/additional Driver through real APIs | NOT RUN |
| Real authorization / wrong assignment | NOT RUN |
| Real sequence / checkpoint / destination | NOT RUN |
| Real stale-state / concurrency / read-back | NOT RUN |
| Human review / QA-13 acceptance / merge | PENDING |

Production intentionally reports service unavailability instead of returning
sample data. This is an integration gap, not a completed production path.
See `frontend/DRIVER_EXECUTION.md` for the adapter boundary and preview commands.
