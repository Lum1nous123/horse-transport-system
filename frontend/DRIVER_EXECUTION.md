# Driver execution workspace — FE-14 / issue #116

## Local implementation status

UI, behavioral preview, and the reviewed Sprint 3 Backend API adapter are
implemented. Production uses authenticated assigned ROAD queue/detail reads and
Vehicle-specific Start/checkpoint/destination writes. **Real API/PostgreSQL E2E
and Cloudinary evidence upload pass. An authenticated real-Backend browser run
passed for ROAD Start and destination arrival on a workflow-created Order;
browser checkpoint replay, Human review, merge, and QA-13 sign-off remain open.**

Approved scope: FR-015, Driver portion of FR-016, and the user's approved
before-Start workspace → after-Start route/check-in design. The focused journey
uses a horizontal timeline for the selected ROAD leg's origin, ordered shared
checkpoints, and destination. Route planning currently persists authoritative
display labels but no structured per-leg or per-checkpoint street address, so
the timeline reports `Address not provided` rather than borrowing the Order's
overall addresses. There are no coordinates, geocoding, routing providers, GPS,
location permissions, or live position indicators.

## Routes and behavior

- `/driver`: assigned work queue, selected Order/leg/Vehicle, shared checkpoint
  plan, and Start or Open journey.
- `/driver/executions/[executionId]`: focused route timeline and selected stop action.
  Opening an unstarted assignment directly still shows the pre-Start view.
- Login sends role `DRIVER` to `/driver`. Production access checks `/auth/me`
  and requires an ACTIVE DRIVER.
- Only the current Driver's assignments are displayed. Direct detail reads are
  checked again for matching execution ID and Driver ownership.
- First and additional Driver Start use the same Vehicle-specific action; no
  Lead Driver or bulk Start is introduced.
- Each mutation is followed by a detail read. No status, timestamp, check mark,
  success message, or navigation is inferred before the saved result confirms it.
- Writes cannot be double-submitted. Older reads cannot replace newer reads.
  Failed writes are reconciled with a read, never automatically resubmitted.
  Failed read-back blocks further actions until refresh succeeds.
- Checkpoint actions require the next unreached shared checkpoint, matching leg,
  current Driver, active Vehicle/leg/Order, and service-provided permission.
- Destination arrival remains distinct from Vehicle/RouteLeg completion; this
  UI never completes a leg, unlocks another leg, supplies welfare, or supplies PoD.

## Contract integration — updated 2026-10-28

Read directly from GitHub:

- [FR-015](https://github.com/Lum1nous123/horse-transport-system/issues/15)
- [FR-016](https://github.com/Lum1nous123/horse-transport-system/issues/16)
- [BE-23](https://github.com/Lum1nous123/horse-transport-system/issues/111)
- [BE-24](https://github.com/Lum1nous123/horse-transport-system/issues/112)
- [FE-14](https://github.com/Lum1nous123/horse-transport-system/issues/116)

The merged contract is documented in `docs/api/SPRINT_3_EXECUTION_API.md` and
`docs/api/SPRINT_3_FRONTEND_ADAPTER.md`. `lib/driver-execution/types.ts` remains
the frontend view-model boundary; `lib/driver-execution/api-service.ts` maps the
Backend DTO and server-authoritative `availableActions` into it. Production never
falls back to preview data. Live Backend/PostgreSQL verification still requires a
configured environment and assigned Sprint 3 demo data.

## Development preview

Run `npm run dev`, then open:

```text
http://localhost:3000/driver?preview=1
```

Preview is accepted **only in development**. It uses session-scoped sample data;
the banner remains visible throughout. A new browser session resets it.

Optional `scenario` values: `ready`, `additional-driver`, `in-progress`, `locked`,
`no-checkpoints`, `destination`, `completed`, `empty`, `error`.
Use `driver=jamie` with the same scenario in the same tab to inspect the second
Driver's independent execution. No production identity can be selected this way.

## Checks

```sh
npm test
npm run lint
npm run build
npm run test:ui
```

Vitest covers component behavior, request ordering, UI action guards, production
access, and the local behavioral service. Playwright exercises Chrome desktop and
mobile on development preview data. Install Chrome, or run `npx playwright
install chrome` on a test machine that needs it. Browser screenshots/traces are
written to ignored `test-results/`.

By default Playwright starts a dev server on localhost:3100. If another Next dev
server already uses this checkout, point tests at it instead; do not stop another
developer's process. In PowerShell:

```powershell
$env:DRIVER_UI_BASE_URL = 'http://localhost:3000'
npm run test:ui
```

Use `localhost`, matching the dev server hostname, to avoid the Next.js dev
cross-origin resource restriction.

Real-API first/additional Driver, wrong-assignment, sequence, checkpoint,
destination, loading/error, and stale-state smoke verification is still required
for closure. Local tests and screenshots do not satisfy that gate.
