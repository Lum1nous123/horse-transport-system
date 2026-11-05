# Sprint 3 ROAD to ROAD E2E fixture

## Scope

`S3QA-R2R-001` is a dedicated synthetic execution fixture. It contains one
Horse, two sequential ROAD RouteLegs, one Vehicle and execution per leg, and
one checkpoint on the non-final leg. It does not create checkpoint arrivals,
welfare evidence, Proof of Delivery, notifications, or status audits directly.

The scripts are preparation artifacts. Their presence does not authorize a
database write or a Cloudinary mutation.

## Deterministic graph

| Record | Identifier | Initial state |
| --- | --- | --- |
| Horse | `d4000000-0000-0000-0000-000000000001` | `S3QA-R2R-MICRO-001` |
| Order | `d4100000-0000-0000-0000-000000000001` | `S3QA-R2R-001`, `READY_TO_SHIP` |
| Order Horse | `d4200000-0000-0000-0000-000000000001` | `ELIGIBLE_FOR_EXPORT` |
| Vehicles | `d430...0001`, `d430...0002` | `AVAILABLE`, capacity 1 |
| Route Plan | `d4400000-0000-0000-0000-000000000001` | `APPROVED`, locked |
| RouteLeg 1 | `d4500000-0000-0000-0000-000000000001` | ROAD sequence 1, `READY` |
| RouteLeg 2 | `d4500000-0000-0000-0000-000000000002` | ROAD sequence 2, `PLANNED` |
| ROAD allocations | `d460...0001`, `d460...0002` | One dedicated Vehicle per leg |
| Horse allocations | `d470...0001`, `d470...0002` | Same Order Horse allocated once per leg |
| Executions | `d480...0001`, `d480...0002` | `NOT_STARTED` |
| Leg 1 checkpoint | `d4a00000-0000-0000-0000-000000000001` | One REST_STOP |

Leg 1 uses Driver One and Escort One. Leg 2 uses Driver Two and Escort Two.
The setup verifies the exact accounts are ACTIVE and role-correct, and checks
the same strict interval-overlap rules used by execution staffing.

The fixed schedule is January 15, 2099: Leg 1 is 08:00–12:00 and Leg 2 is
13:00–17:00. Each departure precedes its arrival, Leg 2 departs after Leg 1
arrives, and execution start has no current-date gate. The dates therefore
satisfy the schema and existing application validation while keeping the QA
window deterministic.

## Confirmed execution expectations

- The same synthetic Order Horse (`d420...0001`) is allocated to Vehicle 1 on
  Leg 1 and Vehicle 2 on Leg 2. The per-leg allocations represent the confirmed
  Vehicle transfer; no separate transfer or vehicle-to-vehicle handover record,
  evidence, signature, photo, API call, or UI action is required.
- Leg 1 starts `READY` and Leg 2 starts `PLANNED`. Leg 2 may become `READY` only
  when the existing lifecycle completes Leg 1.
- Leg 1 completion requires Driver destination arrival, all required checkpoint
  welfare, and Escort final-destination welfare. It does not require Proof of
  Delivery.
- Proof of Delivery is allowed only for the final Leg 2 execution. The Order may
  become `DELIVERED` only after the final leg's required destination welfare and
  Proof of Delivery are persisted through the existing APIs.

The fixture establishes only the initial graph and statuses. It does not insert
any arrival, welfare, transfer, handover, or Proof of Delivery evidence.

## Target approval inputs

The owner-approved target is the Supabase project `horse-transport-system`.
Its branch label is truthfully recorded as `PRODUCTION`; its separately
approved use is `OWNER_APPROVED_DEVELOPMENT_DEMO`. The label is never rewritten
or treated as proof that the database is non-production.

The person authorizing a run must obtain these non-secret values from the
Supabase Dashboard or another independent control-plane record:

- project name: exactly `horse-transport-system`
- Supabase project reference
- Shared Pooler Session Mode endpoint hostname
- database endpoint port: exactly `5432`
- connection mode: exactly `SUPABASE_SHARED_POOLER_SESSION`
- pooler username: exactly `postgres.<project-reference>`
- client-to-pooler TLS mode: exactly `require`
- branch label: exactly `PRODUCTION`
- owner-approved usage: exactly `OWNER_APPROVED_DEVELOPMENT_DEMO`
- database name: exactly `postgres`
- schema name: exactly `public`

The values must not be copied solely from the process that supplies the
database credentials. Passwords, tokens, JDBC URLs, and connection strings must
not be included in commands, logs, reports, or approval messages.

The read-only target check is:

```text
psql -X \
  --set approved_project_name=horse-transport-system \
  --set approved_supabase_project_ref=<independently-approved-project-ref> \
  --set approved_endpoint_host=<independently-approved-endpoint-host> \
  --set approved_endpoint_port=5432 \
  --set approved_connection_mode=SUPABASE_SHARED_POOLER_SESSION \
  --set approved_pooler_username=postgres.<independently-approved-project-ref> \
  --set approved_tls_mode=require \
  --set approved_branch_label=PRODUCTION \
  --set approved_usage=OWNER_APPROVED_DEVELOPMENT_DEMO \
  --set approved_database=postgres \
  --set approved_schema=public \
  --file scripts/sprint3-road-road-target-preflight.sql
```

Credentials must be provided through the approved protected runtime mechanism.
The preflight validates pinned fingerprints for the approved public project
reference and pooler endpoint, reconnects through that exact project-qualified
target without embedding a password, then opens a read-only transaction. It
requires client-to-pooler TLS through libpq `sslmode=require`, then verifies the
actual database, schema, transaction mode, application
tables, and the exact successful Flyway version set. The backend address
and backend-side `pg_stat_ssl` state reported through the multi-tenant pooler
are not accepted as client connection or project identity.
A Spring profile name is never accepted as target proof. The operator must not
override the verified reconnect target.

## Setup approval gate

Running the setup requires a separate explicit approval naming the verified
target and `S3QA-R2R-001`. Only after that approval may the operator add:

```text
--set write_confirmation=WRITE-S3QA-R2R-001@horse-transport-system/PRODUCTION \
--file scripts/sprint3-road-road-e2e-fixture.sql
```

The full command must also include all independently approved target values.
The confirmation deliberately names both the fixture and actual `PRODUCTION`
branch label. The script reruns the read-only identity preflight, then starts
one write transaction. It refuses partial or complete identifier collisions,
missing or incorrect accounts, staff overlap, or Vehicle allocation conflict.
It contains no update, reset, broad upsert, evidence insert, or prefix match.

## Cloudinary cleanup order

Database evidence rows contain exact public URLs, while Cloudinary is an
external resource. Cleanup must therefore occur in this order:

1. Run `sprint3-road-road-cloudinary-manifest.sql` with the independently
   approved target values. It is read-only and lists only evidence URLs reached
   through the exact synthetic Order graph.
2. Delete each listed URL through an approved guarded operation that calls the
   existing `DocumentStorage.deleteByUrl` behavior. Do not delete by a broad
   account, folder, or `horse-transport/orders` prefix.
3. Verify every listed asset is absent from Cloudinary.
4. Preserve the manifest and verification result as test evidence without
   storing credentials.
5. Only then supply
   `cloudinary_cleanup_confirmation=S3QA-R2R-001-ASSETS-DELETED` to database
   cleanup.

There is currently no guarded command-line entry point for step 2. Until one is
implemented or an equivalent exact-URL operation is human-approved, completed
E2E evidence must not be removed from PostgreSQL.

## Database cleanup approval gate

Cleanup requires another explicit approval naming the same verified target and
the exact synthetic namespace. The command must include:

```text
--set cleanup_confirmation=CLEANUP-S3QA-R2R-001@horse-transport-system/PRODUCTION \
--file scripts/cleanup-sprint3-road-road-e2e-fixture.sql
```

If evidence exists, it must additionally include the exact Cloudinary cleanup
confirmation above. The cleanup transaction reconstructs and validates the
whole graph, rejects unexpected upstream records or cross-graph Horse/Vehicle
references, and deletes only exact related notifications, evidence, arrivals,
audits, execution and route records, the synthetic Order Horse, Order, Horse,
and Vehicles. Shared demo accounts are never deleted or modified.
