# Transport Order Workflow

## Mục đích

Tài liệu này tóm tắt state transition chính thức của Transport Order trong phạm vi MVP.

## State Transition

| From | Action / Event | To | Actor |
| --- | --- | --- | --- |
| DRAFT | Customer submits Order | SUBMITTED | Customer |
| SUBMITTED | LM sends locked quotation | QUOTATION_SENT | Logistics Manager |
| QUOTATION_SENT | Signed Stripe webhook confirms Deposit PAID | APPROVED | System |
| APPROVED | Mandatory document is missing, DRAFT, or unsubmitted at Document Completion Deadline | CANCELLED | System |
| APPROVED | Assigned TS rejects a submitted document after the deadline | CANCELLED | System |
| APPROVED | Assigned TS Final Confirms all mandatory documents | APPROVED with Document Phase locked | Transport Specialist |
| READY_TO_SHIP | First RouteLeg starts | IN_PROGRESS | System |
| IN_PROGRESS | All RouteLegs and final handover complete | DELIVERED | System |

## Deposit Rule

- Successful Deposit payment changes Payment to `PAID` and Order to `APPROVED`.
- A paid Deposit is `NON-REFUNDABLE` in every case.
- Cancellation after Deposit does not change Payment from `PAID` and does not create a Stripe refund.

## Document Deadline Rule

- One Document Completion Deadline applies to the whole Order.
- Missing, not uploaded, `DRAFT`, or unsubmitted mandatory documents at the deadline cancel the Order.
- If every mandatory document was submitted and is only `PENDING_REVIEW`, the Order is not cancelled.
- A rejection before the deadline allows the Customer to create and submit a new version before the same deadline. No supplemental deadline is created.
- A rejection after the deadline cancels the Order immediately.
- In every cancellation case above, Deposit remains `PAID` and non-refundable.

## Customer Cancellation Rule

- Customer may manually cancel only in `DRAFT`, `SUBMITTED`, and `QUOTATION_SENT`.
- This rule does not add a manual Customer cancellation action after Deposit.

## Final Confirmation

- Assigned TS may Final Confirm only when every mandatory document for every Horse is `APPROVED`.
- Final Confirm permanently locks the Document Phase.
- Customer then continues to the existing Remaining Balance payment flow.
