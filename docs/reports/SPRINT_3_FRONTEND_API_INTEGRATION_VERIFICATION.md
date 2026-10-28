# Sprint 3 Frontend API Integration Verification

Date: 2026-10-28
Branch: `feature/s3-frontend-api-integration`
Base: `ec76180` (`feat(backend): Sprint 3 execution APIs for frontend integration`)

## Implemented integration

- FE-14 Driver ROAD queue/detail now use the authenticated assigned-execution read APIs.
- Driver Start, next-checkpoint arrival, and destination arrival use the persisted
  `roadLegVehicleId` supplied by Backend reads. Every write is followed by the
  existing detail read-back; the UI does not synthesize lifecycle progress.
- FE-15 Escort ROAD/AIR queue and detail now use the authenticated read APIs.
- ROAD welfare uses Vehicle/checkpoint locators from Backend state. AIR Start,
  destination arrival, welfare, and explicit non-final completion use the
  persisted `routeLegId`.
- FE-16 ROAD/AIR PoD uses the existing multipart mutation contract and reads the
  persisted PoD, handover counts, RouteLeg status, and Order status back through
  execution detail. Server-provided semantic evidence labels are preserved.
- FE-17 tracking now maps the actual persistence-oriented Backend tracking DTO
  into the existing Customer/LM view model, including ROAD Vehicle progress,
  checkpoints, welfare, AIR events, PoD delivery events, and last-updated time.
- Production remains API-backed. Development preview remains available only
  with `preview=1` while `NODE_ENV=development`.

## Verification results

- Frontend TypeScript: PASS (`npm exec tsc -- --noEmit`).
- Frontend ESLint: PASS (`npm run lint`).
- Frontend Vitest: PASS (26 files, 208 tests).
- Frontend Playwright preview suite: PASS (22 tests, desktop/mobile projects).
- Frontend production build: PASS (`npm run build`).
- Backend focused controller tests: PASS (8 tests).
- Backend focused execution/tracking/service/security tests: PASS (30 tests).
- Real Backend + PostgreSQL API/E2E smoke test: PASS.
- Cloudinary welfare and PoD evidence upload/readback: PASS.
- Authenticated browser lifecycle E2E: PARTIAL PASS. A workflow-created ROAD
  Order passed Driver Start/destination, Escort final welfare, PoD, and LM
  tracking through the real browser, Backend, PostgreSQL, and Cloudinary.
  Checkpoint and AIR browser lifecycle replay remain unverified. The Playwright
  suite exercises preview workflows and is not evidence for those remaining flows.

## Demo checklist

| Scenario | Status | Evidence / blocker |
| --- | --- | --- |
| Driver starts a ROAD execution, records the next checkpoint, and arrives at destination | PARTIAL PASS (browser) | Real browser Start and destination arrival passed on a workflow-created Order. Browser checkpoint replay remains unverified. |
| Escort submits ROAD checkpoint/final welfare and reads persisted evidence back | PARTIAL PASS (browser) | Real browser final welfare upload/readback passed; checkpoint welfare browser replay remains unverified. |
| Escort completes required AIR welfare flow | PASS (API) | Real non-final AIR start, arrival, welfare, completion, and next-leg unlock passed. Browser submission is not yet verified. |
| Final ROAD/AIR delivery PoD is submitted and retrieved | PARTIAL PASS (browser) | Real ROAD browser PoD upload/readback passed. AIR browser submission remains unverified. |
| Customer/LM tracking reflects persisted execution progress | PARTIAL PASS (browser) | LM navigation and delivered ROAD tracking rendering passed against persisted data; Customer browser tracking remains unverified. |

## Required environment

Frontend:

- `NEXT_PUBLIC_API_BASE_URL` (normally `http://localhost:8080`)

Backend minimum:

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`
- `JWT_SECRET` (and optional `JWT_EXPIRATION_MINUTES`)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` for
  welfare/PoD evidence uploads
- Stripe settings are required only if the demo data is created by replaying
  the full payment flow.

Optional local account seed:

- Run Backend with profile `local`.
- Set `HTS_LOCAL_DEVELOPMENT_SEED_ENABLED=true` and a non-blank
  `HTS_LOCAL_DEVELOPMENT_SEED_PASSWORD`.
- Seeded accounts are `customer@test.local`, `lm@test.local`, `ts@test.local`,
  `route@test.local`, `driver@test.local`, and `escort@test.local` with the
  environment-provided shared password.

The local seeder creates accounts and Vehicles only. It does not create Sprint 3
execution data. Demo data must include an approved/locked ordered Route Plan,
automatic Driver/Escort assignments, and an Order at `READY_TO_SHIP`. Include:

- a ROAD leg with at least one checkpoint and, for multi-Vehicle coverage, at
  least two independently assigned Vehicles;
- a non-final AIR leg for explicit completion after destination welfare;
- a final ROAD or AIR leg for PoD;
- synthetic JPEG/PNG evidence only.

## Remaining verification gap

Authenticated browser lifecycle E2E has not been replayed against the real
Backend. The completed fixtures support read-only browser smoke verification;
replaying Start/checkpoint/welfare/destination/PoD requires approved scoped
fixture cleanup and reseeding.
