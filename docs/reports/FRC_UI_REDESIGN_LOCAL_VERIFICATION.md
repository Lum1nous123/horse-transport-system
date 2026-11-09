# Fleet & Route Coordinator UI redesign — local verification

Date: 2026-11-07

## Scope and implementation

The two owner-provided approved screenshots guide the FRC Planning Queue and
Order Detail presentation. The implementation retains Next.js, React, Geist,
the original `/logo.png` through `BrandMark`, and the existing service contracts.

Queue changes include the illustrated hero, three distinct illustrated summary
cards with existing computed counts, Assigned Orders heading, table styling,
status badges, action buttons, and informational footer. Detail changes include
the truck hero, metadata card, Route Plan card, approved empty-state copy, and
revision/action footer. The existing editor, ROAD setup, dialogs, and non-empty
legs retain their handlers and state.

Original SVG artwork is code in `FleetRouteArtwork.tsx`: a map/calendar/horse
hero, a horse-transport truck hero, and blue calendar, amber document/pencil,
and purple returned-package miniatures. Artwork is decorative, hidden from
assistive technology, and cannot receive pointer input. No dependency or
external image service was added.

All new CSS selectors are scoped to `.frc-workspace-page`; shared global CSS
and Customer/other-role components were not edited. Existing shared icons are
reused. The header keeps only the existing Planning queue destination. The
existing Refresh queue control and `Revise` action remain operational.

The payment badge retains the existing Paid display for the payment-gated FRC
planning context. The service model supplies no separate payment-status field;
this redesign does not introduce a new field, API request, or eligibility rule.

## Source files

Modified:

- `frontend/components/FleetRouteCoordinatorWorkspaceFrame.tsx`
- `frontend/app/fleet-route-coordinator/page.tsx`
- `frontend/app/fleet-route-coordinator/orders/[orderId]/page.tsx`
- `frontend/components/RoutePlanEditor.tsx` (approved empty-state copy only)
- `docs/project-context/CURRENT_STATE.md`

Added:

- `frontend/components/FleetRouteArtwork.tsx`
- `frontend/components/fleet-route-workspace.css`
- This verification report

## Verification results

- `npm.cmd run build`: PASS, including TypeScript and static page generation.
- `npm.cmd run lint`: PASS.
- `npm.cmd test`: PASS, 32 test files and 235 tests.
- `git diff --check`: PASS.
- Chrome/Playwright checks against the existing development server: PASS.
  - Dynamic queue counts, Refresh queue, and Start navigation with preview identity.
  - Empty-plan submit stays disabled; validation renders the existing issue.
  - Add AIR leg, save/readback, edit, delete, and revision display.
  - Reorder existing journey legs and read back their saved order.
  - ROAD vehicle candidates, unavailable vehicle disabled state, and checkpoints.
  - Incomplete ROAD allocation blocks submission and displays validation feedback.
  - A valid AIR plan submits through the existing confirmation dialog and locks
    the editor in Awaiting LM review.
  - Returned plan feedback/resubmission action and read-only plan controls.
  - Empty queue, read failure, forbidden access, unauthenticated login redirect,
    and Sign out.
  - Queue/detail at 1024px, 768px, and 390px; mobile leg form and existing ROAD
    setup. No horizontal document overflow in these checked states.
  - No Backend API requests from preview scenarios and no observed page errors
    during the main browser verification.
  - Customer header background, border radius, padding, and shadow are unchanged
    before and after visiting FRC at the same viewport.

The tablet check found overflow from the table's absolutely positioned screen
reader action label. Positioning the scroll wrapper relatively contained it;
the responsive checks passed after the fix.

## Screenshot evidence

- `docs/ui-snapshots/frc-redesign-queue-desktop.png`
- `docs/ui-snapshots/frc-redesign-detail-desktop.png`
- `docs/ui-snapshots/frc-redesign-existing-legs-desktop.png`
- `docs/ui-snapshots/frc-redesign-queue-mobile.png`
- `docs/ui-snapshots/frc-redesign-detail-mobile.png`
- `docs/ui-snapshots/frc-redesign-road-setup-mobile.png`

## Limits

Browser interaction verification uses the existing development preview adapter.
Real Backend/payment/lifecycle E2E was not rerun for this presentation-only change.
No Backend, database, authentication, API adapter, or dependency file was edited.
No known blocking issue remains in the checked UI states. Work is uncommitted.
