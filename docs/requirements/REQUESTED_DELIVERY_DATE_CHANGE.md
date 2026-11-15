# Desired delivery date change

Status: Approved by the project owner in the implementation request of 2026-11-14.
This amendment supersedes the departure-input requirement in FR-002 and related
Order summaries only. Other approved requirements remain unchanged.

## Customer request

The Customer supplies a desired calendar date for the Horses to reach the Order's
destination. The UI calls it **Desired delivery date**. It replaces the Customer's
Requested departure input and has no time-of-day component.

The date is a preference for the assigned FRC's planning, not a guaranteed arrival
or a mandatory delivery deadline. An otherwise valid Route Plan may arrive before
or after this preference. A difference does not itself block Submit/Confirm,
cancel the Order, or create a late-delivery warning.

## Acceptance criteria

- Incomplete DRAFTs may omit the date. Customer Submit and resubmission of an
  LM-rejected Order require the date, instead of a requested departure timestamp.
- The API accepts and returns `requestedDeliveryDate` as `YYYY-MM-DD`; timestamps
  and invalid calendar dates are rejected. No new future-date restriction applies.
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
- RouteLeg planned departure/arrival, actual execution timestamps, Vehicle/staff
  overlap checks, welfare, PoD, and actual Order delivery timestamps retain their
  existing meanings and behavior.

## Data representation

`transport_orders.requested_delivery_date` is nullable PostgreSQL `date`, mapped to
Java `LocalDate`. Nullability supports DRAFT and legacy Orders; Submit enforces
the business requirement. `requested_departure_at` stays as legacy data in this
release and is no longer written through Customer Order create/update requests.
