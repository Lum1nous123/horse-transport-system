# Sprint 3 real-API demo runbook

This runbook targets the reviewed local-profile Supabase development/demo database.
It never resets existing data. All fixture business identifiers start with `S3DEMO-`
and all deterministic fixture UUIDs start with `d3`.

## Supported accounts

The application supports `LOGISTICS_MANAGER`, `TRANSPORT_SPECIALIST`,
`FLEET_ROUTE_COORDINATOR`, `DRIVER`, `ESCORT`, and `CUSTOMER`. It has no `ADMIN`
role. Sprint 3 creates one account per supported role, plus a second Driver and
Escort, under the `*.s3demo@example.com` namespace.

The shared password must be supplied at runtime through
`HTS_DEMO_STAFF_PASSWORD`. Do not put it in a tracked file.

## Seed

1. Export the datasource identity and credential variables required by
   `DemoStaffSeedSafety`, including the independently confirmed expected host,
   database, and schema.
2. Compile the Backend.
3. Run `Sprint3DemoAccountSeedCommand` once without
   `--confirm-demo-staff-seed` to perform the read-only identity preflight.
4. Run it again with `--confirm-demo-staff-seed` to add missing namespaced
   accounts. Existing matching accounts are verified, never overwritten.
5. From `backend/`, run `psql -X -f scripts/sprint3-demo-fixtures.sql` using the
   same reviewed datasource. Re-running is a no-op when the complete namespace
   exists.

## Scenario map

- `S3DEMO-ROAD-MULTI`: two Drivers, two Escorts, two vehicles, one checkpoint,
  final ROAD handover, and Customer/LM tracking.
- `S3DEMO-AIR-NONFINAL`: AIR welfare and explicit completion followed by an
  unlocked ROAD leg.
- `S3DEMO-AIR-FINAL`: final AIR welfare and PoD.

Use the assigned Driver/Escort workspaces to execute lifecycle actions. Use the
Customer and Logistics Manager tracking views for `S3DEMO-ROAD-MULTI`.

Real authenticated API/PostgreSQL E2E and Cloudinary evidence upload/readback
have passed. The preview Playwright suite is not a real-Backend browser test.
Authenticated browser lifecycle E2E must remain `NOT YET VERIFIED` until the
actions are performed through the UI. Completed fixtures may be used for
read-only queue, detail, evidence, PoD, and tracking smoke checks; lifecycle
replay requires explicit approval before scoped cleanup and reseeding.

### Read-only browser smoke checklist for completed fixtures

1. Sign in as each demo Driver and confirm the assigned ROAD execution detail
   shows completed checkpoint/destination progress without offering stale writes.
2. Sign in as each demo Escort and confirm ROAD/AIR welfare and PoD evidence
   read back on the assigned execution details.
3. Sign in as the demo Customer and open tracking for `S3DEMO-ROAD-MULTI`;
   confirm delivered progress and persisted milestones render.
4. Sign in as the demo Logistics Manager and confirm the same tracking state.
5. Treat Start/checkpoint/destination/welfare/PoD browser replay as a separate
   test requiring explicit approval for scoped fixture cleanup and reseeding.

## Clean up

Cleanup is deliberately two-step:

1. `psql -X -f scripts/cleanup-sprint3-demo-fixtures.sql`
2. Optionally remove the dedicated accounts with
   `psql -X -f scripts/cleanup-sprint3-demo-accounts.sql`

The account cleanup refuses to run while any `S3DEMO-%` order remains.
The fixture cleanup derives every deletion target from the three exact demo
order codes inside one transaction; it does not use UUID-prefix deletion.
