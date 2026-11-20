# Desired delivery date change

Status: Approved by the project owner in the implementation request of 2026-11-14.
This amendment supersedes the departure-input requirement in FR-002 and related
Order summaries. The separately approved FRC planning amendment dated
2026-11-15 below further supersedes the advisory treatment of the final planned
arrival date and adds the stated RouteLeg connection and time-order rules.

## Superseding FRC planning amendment (approved 2026-11-15)

The project owner approved a further rule for planned Route Plans. For an Order
with a `requestedDeliveryDate`, the final RouteLeg's planned arrival calendar
date must equal that Order date. The assigned FRC may set the final leg's arrival
time; the date is sourced from the Order and is read-only in FRC planning.
Route validation and submission are blocked when the saved final-leg arrival
date differs. Orders without a desired date (including legacy Orders) retain the
existing unrestricted final-arrival date behavior.

This rule constrains the **planned** arrival date only. It does not guarantee or
assert the actual delivery date, change actual `deliveredAt`, or create a late
delivery cancellation/incident workflow. This amendment supersedes the advisory
only statements below solely for the final planned RouteLeg arrival date.

FRC may split a journey into any number of connected RouteLegs or keep it as a
single leg. When a connection point is edited from either adjacent leg, the
matching previous destination / next origin is updated to the same value.
Each later RouteLeg must depart strictly after the previous RouteLeg arrives.

The existing accepted behavior below remains in force for Customer date entry,
Order lifecycle, and all other date uses, subject only to this amendment.

## Customer request

The Customer supplies a desired calendar date for the Horses to reach the Order's
destination. The UI calls it **Desired delivery date**. It replaces the Customer's
Requested departure input and has no time-of-day component.

The date is the assigned FRC's planned-delivery target, not a guarantee of actual
arrival or a mandatory actual-delivery deadline. The final planned RouteLeg
arrival date follows the superseding FRC planning amendment above. Actual delivery
may still occur on another date; that difference does not cancel the Order or
create a late-delivery warning.

## Customer date-entry amendment (approved 2026-11-20)

The project owner later approved requiring the Customer's desired delivery date
to be strictly in the future. The Customer date picker and API reject today and
past dates when creating or editing an Order; submission also rejects legacy
drafts with a missing or non-future date. This changes the prior acceptance
criterion below that said no future-date restriction applies. It does not change
the meaning of the preference or the FRC planned-arrival constraint.

## Acceptance criteria

- Incomplete DRAFTs may omit the date. Customer Submit and resubmission of an
  LM-rejected Order require the date, instead of a requested departure timestamp.
- The API accepts and returns `requestedDeliveryDate` as `YYYY-MM-DD`; timestamps
  and invalid calendar dates are rejected. A provided date must be strictly in
  the future.
- Existing Orders retain their legacy requested departure values. Delivery dates
  are not inferred from departure, route schedules, or handover dates. Existing
  submitted/active Orders can continue their lifecycle with no desired date.
- Read screens display **Not provided** when the desired date is absent. Customer
  editing is still governed by the existing Order status/ownership rules.
- Planning/assignment queues that previously ordered by the Customer's departure
  use desired delivery dates, preserve existing status priority, put missing dates
  last, and use a stable Order identity tie-breaker.
- The LM dashboard's **Upcoming desired deliveries** includes today and later
  preferences from ready-to-ship/active journeys and excludes missing dates.
- RouteLeg planned departures, non-final planned arrivals, actual execution
  timestamps, Vehicle/staff overlap checks, welfare, PoD, and actual Order
  delivery timestamps retain their existing meanings and behavior. The final
  planned arrival date follows the superseding FRC planning amendment above.

## Data representation

`transport_orders.requested_delivery_date` is nullable PostgreSQL `date`, mapped to
Java `LocalDate`. Nullability supports DRAFT and legacy Orders; Submit enforces
the business requirement. `requested_departure_at` stays as legacy data in this
release and is no longer written through Customer Order create/update requests.
