# Driver execution workspace — FE-14 / issue #116

## Local implementation status

UI and behavioral preview are implemented. **Not Done / not integrated with real
BE-23/BE-24 APIs.** No production execution request is fabricated or routed to a
mock. Human review, real-API verification, merge, and QA-13 sign-off remain open.

Approved scope: FR-015, Driver portion of FR-016, and the user's approved
before-Start workspace → after-Start route/check-in design. The route image is
an ordinal SVG schematic, not an accurate geographic map. There are no
coordinates, geocoding, routing providers, GPS, location permissions, or live
position indicators.

## Routes and behavior

- `/driver`: assigned work queue, selected Order/leg/Vehicle, shared checkpoint
  plan, and Start or Open journey.
- `/driver/executions/[executionId]`: focused schematic and selected stop action.
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

## Contract gate — verified 2026-10-20

Read directly from GitHub:

- [FR-015](https://github.com/Lum1nous123/horse-transport-system/issues/15)
- [FR-016](https://github.com/Lum1nous123/horse-transport-system/issues/16)
- [BE-23](https://github.com/Lum1nous123/horse-transport-system/issues/111)
- [BE-24](https://github.com/Lum1nous123/horse-transport-system/issues/112)
- [FE-14](https://github.com/Lum1nous123/horse-transport-system/issues/116)

These issues define actor/state/sequence behavior but contain no concrete HTTP
endpoints, DTOs, or published execution error codes; they had no comments at
inspection. The inspected GitHub main tree contains execution staffing models,
but no Driver execution controller or execution API contract. The local checkout
likewise has no BE-23/BE-24 execution controller.

Consequently, `lib/driver-execution/types.ts` is a **frontend view-model boundary**,
not a claimed backend contract. Its revision field, permissions, and normalized
errors must be mapped to the approved server contract. The preview follows the
confirmed business rules, but is not proof of frozen wire-contract compatibility.

`productionDriverExecutionService` explicitly returns `CONTRACT_UNAVAILABLE`
until a real adapter can be written. It never falls back to preview data. The
user sees an unavailable/retry state without implementation details or a fake
empty queue. Backend authorization remains mandatory in the eventual adapter.

To unblock integration, obtain the published list/detail/Start/checkpoint/
destination endpoints, request/response DTOs, authorization and stale/duplicate
error contracts, and read-after-write behavior. Map these through the existing
central `apiFetch` helper with the authenticated Bearer token. Verify BE-21's
persisted first-leg READY state, then test against the real services.

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
