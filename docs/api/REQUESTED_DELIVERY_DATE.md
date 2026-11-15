# Requested delivery date API change

## Contract

Existing endpoint URLs and role/ownership rules are unchanged. Order create and
update bodies accept the new optional property:

```json
{
  "requestedDeliveryDate": "2026-11-25"
}
```

Draft save may send null or omit the property. Submit/resubmit requires a persisted
date and reports `requestedDeliveryDate` in the existing missing-fields error if
absent. Invalid dates and timestamp strings produce a malformed-request HTTP 400.
Past dates are not newly prohibited.

Order detail/list, LM inbox/assignment, TS document inbox, FRC planning queue/context,
LM tracking list, and journey tracking responses include this date or null.
The legacy response property `requestedDepartureAt` remains available. Sending a
legacy departure in an Order create/update request does not populate or substitute
for the desired date, and does not overwrite stored legacy departure data.

## Display and scheduling

Frontend inputs use `type="date"` and send the exact calendar string. Displays
format the calendar date without converting it to the browser timezone; absent
values show **Not provided**. RouteLeg timestamps remain datetime values.
The preference is advisory and has no effect on route validity, cancellation,
Vehicle/Driver/Escort overlap eligibility, or actual `deliveredAt`.

## Rollout

1. Deploy the backend with Flyway V9, which adds the nullable column and index.
   Existing migrations and existing Order departure values are not rewritten.
2. Deploy the frontend and ask users with old tabs to refresh. An old client can
   still read the legacy field, but cannot Submit using departure alone.
3. Verify a date-only draft, Submit, legacy Order display, FRC/LM summary, and
   actual route scheduling independently. The frontend requires the updated
   backend; deploy backend first.

No automatic backfill or legacy-column removal is included. No manual SQL against
Supabase is part of the implementation verification. Migration execution and live
end-to-end checks are separate rollout steps.
