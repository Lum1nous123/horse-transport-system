# Sprint 3 final browser E2E fixtures

Preparation only. Neither setup nor lifecycle actions have been executed.
Supabase's actual branch label remains `PRODUCTION`; the project owner's
separate approved usage is `OWNER_APPROVED_DEVELOPMENT_DEMO`.

## Fixture graph and record count

`S3QA-AIR-MVR-001` contains 18 initial records:

- 2 Horses, 1 Transport Order, 2 Transport Order Horses;
- 2 Vehicles, 1 approved Route Plan, 2 Route Legs;
- 2 ROAD Vehicle links, 2 ROAD Horse allocations, 2 ROAD executions;
- 1 AIR execution and 1 shared ROAD checkpoint.

Leg 1 is AIR `READY`; Leg 2 is ROAD `PLANNED`. The AIR execution uses Escort
One. ROAD Vehicle 1 uses Driver One/Escort One/Horse 1. ROAD Vehicle 2 uses
Driver Two/Escort Two/Horse 2. Both Horses travel on the AIR leg.

`S3QA-AIR-FINAL-001` contains 6 initial records:

- 1 Horse, 1 Transport Order, 1 Transport Order Horse;
- 1 approved Route Plan, 1 AIR Route Leg and 1 AIR execution.

The total is exactly 24 initial records. Order staff assignments and Route Plan
review records are not required by the already verified Sprint 3 direct fixture
mechanism and are not added merely to increase the count.

## Safety and authorization

Run `sprint3-final-browser-target-preflight.sql` first with the independently
approved target values already documented for `horse-transport-system`. It
reuses the pinned project/Shared Pooler Session Mode endpoint, project-qualified
username, client-to-pooler `sslmode=require` and exact Flyway guard, then checks schema, columns, enums,
all deterministic identifiers and business keys, ACTIVE role-correct accounts,
Driver/Escort overlap, Vehicle conflicts and the fixed schedule in a read-only
transaction.

The approved connection mode is exactly `SUPABASE_SHARED_POOLER_SESSION` on
port `5432`. The pooler's backend server address is not used as project
identity; the guard instead requires the independently pinned project reference
and endpoint plus username `postgres.<project-reference>`, database `postgres`,
schema `public`, TLS mode `require`, branch label `PRODUCTION`, and usage
`OWNER_APPROVED_DEVELOPMENT_DEMO`.

Setup is atomic and requires both exact approvals:

```text
write_confirmation_air_mvr=WRITE-S3QA-AIR-MVR-001@horse-transport-system/PRODUCTION
write_confirmation_air_final=WRITE-S3QA-AIR-FINAL-001@horse-transport-system/PRODUCTION
```

Credentials must remain in the approved protected runtime mechanism. Never put
passwords, JWTs, JDBC URLs or connection strings in commands, screenshots or
reports. Setup inserts only the 24 initial graph records. It creates no arrival,
welfare, PoD, notification or audit record and performs no update, upsert,
delete or cleanup.

## Browser environment

- Start the real Backend with its reviewed local configuration.
- Start the Frontend with `NEXT_PUBLIC_API_BASE_URL` targeting that Backend.
- Do not use `preview=1` or any mock adapter.
- Authenticate through the normal login UI using the existing demo accounts.
- Use separate browser profiles or explicit logout/login between roles.
- Preserve HTTP status/response evidence but redact JWTs and secrets.

Prepare nine distinct synthetic JPEG/PNG files, each at most 10 MiB:

- Fixture A: AIR final welfare; two ROAD checkpoint welfare files; two ROAD
  final welfare files; two ROAD PoD files — 7 uploads.
- Fixture B: AIR final welfare and a distinct AIR PoD file — 2 uploads.

## Fixture A PASS/FAIL checklist

| Step | Role | PASS condition |
| --- | --- | --- |
| Premature ROAD check | Driver One/Two | ROAD leg remains `PLANNED`; no Start action is available |
| AIR Start | Escort One | Order and AIR leg become `IN_PROGRESS` |
| AIR destination | Escort One | AIR execution becomes `DESTINATION` |
| AIR welfare | Escort One | AIR welfare is persisted and read back |
| AIR Complete | Escort One | AIR becomes `COMPLETED`; ROAD becomes `READY` |
| ROAD independent Start | Driver One, Driver Two | Both Vehicle executions start independently |
| Checkpoint arrivals | Driver One, Driver Two | Each execution records its own arrival at the shared checkpoint |
| Checkpoint welfare | Escort One, Escort Two | Evidence is attached to the matching Vehicle only |
| Vehicle 1 destination/final welfare | Driver One, Escort One | Vehicle 1 completes; ROAD leg remains `IN_PROGRESS` |
| Vehicle 2 destination/final welfare | Driver Two, Escort Two | Vehicle 2 completes; Order is still not `DELIVERED` |
| PoD 1 | Matching Escort | Handover progress is `1/2`; Order remains `IN_PROGRESS` |
| PoD 2 | Matching Escort | ROAD becomes `COMPLETED`; Order becomes `DELIVERED` |
| Tracking | LM, Customer | AIR and both ROAD Vehicle streams, welfare and delivery are visible |

## Fixture B PASS/FAIL checklist

| Step | Role | PASS condition |
| --- | --- | --- |
| AIR Start | Escort One | Order and AIR leg become `IN_PROGRESS` |
| AIR destination | Escort One | AIR execution becomes `DESTINATION` |
| AIR welfare | Escort One | Final welfare is persisted and read back |
| Pre-PoD state | Escort One | Order is not `DELIVERED` |
| Final-leg actions | Escort One | No separate Complete action; PoD is available |
| AIR PoD | Escort One | PoD image is distinct from welfare image |
| Delivery | Escort One | AIR becomes `COMPLETED`; Order becomes `DELIVERED` |
| Tracking | LM, Customer | AIR welfare, PoD and delivered status are visible |

## Expected writes after separate approval

Fixture setup inserts exactly 24 rows described above. Browser lifecycle APIs
are expected to update the two Orders, three Route Legs, two ROAD executions and
two AIR executions; insert two checkpoint arrivals, six welfare rows and three
PoD rows; and generate the normal status-audit and Customer-notification rows.
Cloudinary receives nine synthetic evidence assets. No cleanup is authorized by
this preparation.
