# Sprint 3 Frontend adapter mapping

The Backend execution DTOs are persistence-oriented. FE-14/15/16 adapters should map them into the existing view models instead of duplicating Backend state or deriving actions optimistically.

## Identifier mapping

- ROAD detail route: `executionId`.
- ROAD mutation/readback locator: `roadLegVehicleId`.
- AIR detail route: `executionId`.
- AIR mutation/readback locator: `routeLegId`.
- Checkpoint mutation locator: `checkpoints[].id`.

## State and actions

- Render queue state from `status`, `routeLegStatus`, and `handoverProgress`.
- Enable controls exclusively from `availableActions`.
- After every mutation, refetch the execution detail; do not synthesize a state transition in the client.
- Use `proofOfDeliveryAvailable` for the final ROAD handover affordance and use AIR `availableActions.complete` only for explicit non-final completion.
- Queues are active work only. A completed detail remains addressable by its `executionId`, but there is no history-list API.

## Evidence

- Use `photoUrl`/`proofPhotoUrl` as the image source.
- Use `photoName`/`proofPhotoName` as the download/display label. These are semantic labels, not original filenames.
- Public Cloudinary URLs are Sprint 3 demo-only and must use synthetic, non-sensitive media.

## Tracking

FE-17 continues to call `GET /api/v1/orders/{orderId}/tracking`. Do not adapt execution queue/detail DTOs into a second tracking API.

Canonical response fixtures are in [SPRINT_3_EXECUTION_API.md](SPRINT_3_EXECUTION_API.md).
