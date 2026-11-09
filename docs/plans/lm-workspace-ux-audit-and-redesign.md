# LM Workspace — UX Audit and Redesign Plan

Ngày: 2026-11-06. Trạng thái: **Phase 0 được PO duyệt; Phase 1/2 vẫn PROPOSED**.

### Revalidation against latest main — Phase 0

- Origin/main được fetch và xác minh ở `3c7bcc74f96d84f49c2d3f45829048f4d2395457`; audit base `194f52d` là ancestor, chậm 8 commits. Diff chỉ gồm Customer/TS/Driver UI và global styling, không thay LM routes, services hoặc Backend contracts. Toàn bộ finding Phase 0 vẫn áp dụng trước sửa; không có finding Phase 0 nào đã được main khắc phục.
- Thư mục chat mặc định không phải Git repository. Development worktree cũ là `D:\\project\\horse-transport-system-s3-clean`, branch backup; chỉ có audit untracked trước thao tác. Implementation sử dụng worktree cô lập `D:\\project\\horse-transport-system-lm-phase0`, branch `feature/lm-phase0-truthful-review`, base đúng SHA main trên. Audit gốc được giữ nguyên và sao chép vào worktree mới.
- Các đoạn inventory bên dưới ghi nhận **baseline trước Phase 0**, không mô tả source sau fix. Sau Phase 0: real review adapter không còn cache, không tạo revision/customer/staff/horse names; Confirm/Return trả typed persisted decision response. UI phân biệt server detail read, decision response và preview. Assignment dùng single-flight guard và GET-only reconciliation; quotation có retry GET độc lập.
- GET review chỉ hỗ trợ pending; khi mất response sau quyết định đã commit, retry GET có thể tiếp tục trả stale/not-found. UI giữ khóa, hướng về queue/tracking và không replay decision. Không thêm endpoint/history hay thay Backend.
- Điều chỉnh plan: bỏ V1 Pending Actions chart vì lặp đúng ba KPI. Giữ ba compact action tiles có deep links và một chart trạng thái trackable cohort (V2). Không triển khai Overview/chart/navigation trong Phase 0. Shared shell/queue redesign chuyển Phase 1.


Workspace được audit: `D:\project\horse-transport-system-s3-clean`, branch `backup/sprint3-e2e-2026-10-28`, HEAD `194f52d8296088c9dd4f57e1e3ad9d48470e26d0`. Working tree sạch trước audit. Đây là phân tích source/contract; không phải browser usability study, không gọi mutation API hoặc truy vấn database, không xác nhận live dataset. Các số liệu ví dụ trên wireframe đều là placeholder, không phải thống kê production.

## 1. Executive summary

LM đã có đủ entry points cho ba quyết định chính: xử lý yêu cầu/quotation, phân công TS/FRC, duyệt Route Plan; đồng thời có queue/detail theo dõi journey. Vấn đề chính là tổ chức thông tin và độ trung thực của presentation với contract, không phải thiếu một hệ thống dashboard lớn.

Đề xuất giữ **4 navigation items**: `Overview`, `Orders & quotations`, `Staff assignment`, `Route reviews`. Tracking được tổ chức thành tab `Journeys` trong Orders & quotations bằng route `/logistics/tracking` hiện có. Chỉ thêm một view Overview; không thêm trang Incident, Delay, Fleet hoặc Staff Management. Overview là điểm tổng hợp queue, không thay thế các trang thao tác nghiệp vụ.

Top 5 vấn đề và hướng xử lý:

| Vấn đề đã xác minh | Hướng xử lý |
| --- | --- |
| Không có overview; LM phải mở từng queue để biết việc cần làm | Tổng hợp ba action queues với deep links, mỗi nguồn có loading/error riêng |
| Các trạng thái Order, assignment, Route Plan và execution xuất hiện cùng kiểu label nhưng khác ý nghĩa | Tách nhãn domain; tabs theo trạng thái thật; không biến derived group thành status mới |
| Route Review UI khẳng định validation Passed và revision/customer placeholder vượt dữ liệu real adapter | Loại claim không có nguồn; hiển thị dữ liệu có thật và giữ Backend là nơi quyết định validation |
| Pending và history/assigned cùng xuất hiện mặc định; review table nhiều cột; detail lặp metadata | Mặc định actionable, history là tab phụ; list gọn, detail mở theo nhu cầu |
| Navigation/layout/preview behavior và refresh không đồng nhất giữa các page | Một LM shell, active nav thống nhất, error/retry/freshness rõ; giữ tracking preview unavailable đúng thực tế |

Không cần dependency mới. Overview đề xuất dùng ba action tiles và một chart trạng thái journey với HTML/CSS và bảng số tương đương cho accessibility. Không đề xuất GPS, real-time sync, on-time score, escalation hay incident metric.

### Nguồn và cách phân loại

- **Confirmed business**: `docs/requirements/Horse_Transport_System_Confirmed_Business_Workflow_Specification.docx`, đặc biệt §§1–5, 13–16, 21–26; approved FR-003/004/013/014/019 trong `docs/requirements/Functional_Requirements_Proposed.docx`; `docs/business-rules/Business_Rules.docx`, BR-01/16/17/18/19/23; `docs/erd/erd.dbml`.
- **Implemented**: các file FE/BE nêu trong từng mục. Source hiện tại quyết định khả năng triển khai; DTO/preview không được nâng thành business rule.
- **Proposed UX**: mọi cấu trúc màn hình, cột, chart, thứ tự, priority và AC trong báo cáo này; chưa phải requirements đã được phê duyệt.
- `CURRENT_STATE.md` đã đọc để hiểu handoff, không dùng để chứng minh contract. `docs/business-rules.md` rỗng và `docs/requirements/transport-order-workflow.md` còn TBD, không dùng làm source of truth. Confirmed workflow ghi rõ supersedes các quyết định cũ; vì vậy BR-05/20/21 còn “Cần xác nhận” không phải cơ sở tạo LM SLA/escalation dashboard. Các khác biệt tài liệu cũ không được giải quyết bằng thêm business behavior.
- Đã đọc local Senior BA skill theo AGENTS.md. Local solution-architect SKILL.md rỗng nên không bổ sung constraint; không có quyết định kiến trúc mới trong audit.

## 2. Inventory của implementation hiện tại

Không có `app/logistics/layout.tsx`; chỉ có root layout chung. Frame LM được dựng trong từng page hoặc qua component; không có LM Overview/dashboard/chart hiện hữu.

| Route | Source / layout | Mục đích, dữ liệu và actions hiện tại | Real / preview |
| --- | --- | --- | --- |
| `/logistics` | `frontend/app/logistics/page.tsx`; header riêng | Master–Detail SUBMITTED inbox. Search client, refresh, select; ID/status/route/horses/mode/created date. Detail: departure/contact/special requirements; quotation line items/total/deposit/remainder/notes; create/save/send quotation, Reject + reason, confirmation dialogs | Real orders/quotation APIs; dev-only local sample orders and temporary quotation/reject state |
| `/logistics/assignments` | `app/logistics/assignments/page.tsx`; AssignmentWorkspaceFrame | Needs assignment + Assigned panels; order/route/departure/horses/mode, counts, refresh, Assign/View links | Real two assignment inbox requests; dev mock with preview bridge |
| `/logistics/assignments/[orderId]` | same folder detail page; shared frame | Order summary; TS/FRC candidate lists with name/email/activeOrderCount and radios; selected pair bar; assign once; persisted pair read-only + assignedAt | Real order, assignments, candidates, POST then GET; preview handoff to TS appears only in preview |
| `/logistics/route-reviews` | `app/logistics/route-reviews/page.tsx`; shared frame | Pending review + Locked results; table Order/Route/Departure/Horses/Mode/FRC/Submitted or Reviewed; review/result/tracking links | Real pending inbox enriched with detail/order/staff reads; real adapter returns `locked: []`; preview provides richer queue |
| `/logistics/route-reviews/[orderId]` | same folder detail page; shared frame | Route summary; ordered leg table; expandable allocations/checkpoints/AIR fields/staffing; validation list; Return reason panel; irreversible Confirm & lock panel; refresh/readback | Real detail/return/confirm mapping with module cache; preview has explicit validations/revision/identity fixtures |
| `/logistics/tracking` | `app/logistics/tracking/page.tsx`; shared frame | Authenticated tracking orders; order-number search; Order/Status/Route/Mode/Departure/Horses/action table; refresh | Real `/api/v1/lm/tracking-orders`; preview explicitly unavailable, no mock list |
| `/logistics/orders/[orderId]/tracking` | route wrapper → `components/JourneyTrackingView.tsx` | Journey header, status, last event timestamp; leg overview; native expandable ROAD/AIR legs; Vehicles/Horses/staff contacts/checkpoints/evidence/delivery events; refresh | Real tracking mapper; explicit dev preview with scenario guards; same journey component as Customer, without Customer notification sidebar for LM |

Existing reusable UI: `AssignmentWorkspaceFrame`, `BrandMark`, `JourneyTrackingView`, `Leg`, `Vehicle`, native details/summary, route leg expansion, skeleton/empty/error components expressed inline, quotation/rejection confirmation flows. Styles are primarily hand-written global CSS in `frontend/app/globals.css` and `components/journey-tracking.css`; Tailwind 4 is installed but this workspace does not use a component/chart library. `frontend/package.json` has Next/React/page-mascot and development test tooling; no Recharts/Chart.js, drawer library or headless component library. LM currently uses inline decision panels and modal confirmations, not a general-purpose drawer system.

### Verified API boundaries

| Business area | Existing contracts / restrictions |
| --- | --- |
| Submitted review | `GET /api/v1/orders/inbox?status=SUBMITTED`. `TransportOrderService.findLogisticsManagerInbox` rejects any status other than SUBMITTED (lines 61–66). `GET /api/v1/orders` is Customer-owned, not an all-orders LM API |
| Quotation | `/api/v1/orders/{id}/quotation`: GET/POST/PUT; POST `/send`; `SecurityConfig` protects LM mutations. Separate quotation DRAFT/SENT, no PENDING_QUOTATION Order status |
| Rejection | POST `/api/v1/orders/{id}/reject`, reason required, only SUBMITTED |
| Assignment | GET `/api/v1/orders/assignment-inbox?state=NEEDS_ASSIGNMENT|ASSIGNED`; GET `/{id}/assignment-candidates?role=...`, GET/POST `/{id}/staff-assignments` |
| Assignment scope | `OrderStaffAssignmentService.findInbox` lines 38–47: unassigned APPROVED vs assigned non-terminal Orders. ASSIGNED is not an all-time assignment archive |
| Route review | GET `/api/v1/lm/route-plan-reviews` returns pending only. GET `/orders/{id}`, POST `/return`, POST `/confirm`. `RoutePlanService.getLmReviewDetail` finds pending plan/review (lines 418 onward); not a general historical locked-plan reader |
| Tracking list | GET `/api/v1/lm/tracking-orders`: Order in APPROVED/READY_TO_SHIP/IN_PROGRESS/DELIVERED **and approved Route Plan**; createdAt descending (`LogisticsTrackingOrderService`) |
| Tracking detail | GET `/api/v1/orders/{id}/tracking`, owner/LM scope; mapper validates and maps raw DTO (`frontend/lib/journey-tracking/service.ts`) |

Array contracts inspected here are unpaginated; FE may count/filter the returned collections. Counts are scoped to each collection and retrieval time. If pagination arrives later, counts must use server totals, not current page length. No general LM status aggregate API, all-orders search, locked review archive, SLA/delay feed or scheduled analytics job was found in the audited LM controllers/services.

## 3. Role-based information requirements

| Level | Information for LM | Placement and reason |
| --- | --- | --- |
| Critical | Submitted requests; unassigned APPROVED orders; pending route reviews; failed reads; explicit irreversible-action warning | Overview/action queues and active decision screen; these are LM-owned decisions |
| Important | Order code, route, requested departure, actual domain status, mode/horse count; assigned FRC for review; active journeys | Compact management rows and scope-labelled counts |
| Secondary | Recipient phone/email, exact customer requirements, quote arithmetic/notes, candidate identity, saved pair timestamp, route allocations/checkpoints, welfare photos/notes, execution contacts, delivery events | Selected-order/detail context; needed to review but not on dashboard or every row |
| Unnecessary by default | Recipient/customer contact in global queue, full staff emails across lists, technical UUIDs as person/horse names, repeated read-only badges, all leg evidence at once, customer payment-provider internals | Remove from default list. UUIDs retained as labelled identifiers where needed, never relabelled as names |
| Not LM actions | Document approval/upload, document deadline/Final Confirm; editing route allocations; manually selecting Driver/Escort; execution Start/arrival/welfare/PoD; approving refund or Deposit acceptance | Remain with Customer/TS/FRC/Driver/Escort/System as confirmed workflow specifies |

LM responsibility: price/send quotation, reject SUBMITTED with reason, select one ACTIVE TS + one ACTIVE FRC atomically after approval, Confirm/Return Route Plan, observe journey. Order APPROVED is caused by signed Deposit webhook; LM does not manually approve the Order. Refund is automatic in confirmed document-deadline flow. Tracking contacts are permitted by FR-019, but expose them only inside relevant journey/Vehicle details. Candidate workload is informational; it is not a recommendation, score or capacity limit.

## 4. Page-by-page UX audit

### 4.1 Submitted orders (`/logistics`)

Primary task: understand a request and prepare/send a quotation or reject it. Existing hierarchy is sound: left inbox, right selection, summary/contact/requirements/quotation. Preserve that structure and existing client search, full-width surface, exact customer notes and one Prepare quotation entry.

Problems: title “Logistics workspace” hides that this is only submitted-order review; “awaiting review” means SUBMITTED, not total pending LM work. A prepared quotation's full editable form occupies much of the default detail. Repeated status and metadata use space, particularly when reviewing several requests. There is no collection-wide quotation-state information: draft/no-draft is only known after fetching selected quotation. A quotation read error suppresses the prepare button and shows text referring to a button above (`page.tsx` lines 470–478); dedicated quotation retry is absent.

Proposed: label nav `Orders & quotations`, active tab `Submitted`; keep detail essentials (route, mode, requested time, horse count, exact requirements, delivery contact) visible. Before preparation show a compact quote summary. On Prepare/Edit draft expand the existing editor with Save/Send controls. On load failure show “Quotation unavailable” and Retry read, not Not started. Do not introduce list-level “Needs quotation / Draft quote” chips until data exists for every row; avoid N+1 quotation fetch just for badges. Keep Reject secondary and reason/confirmation intact. Missing inbox recipient search is not a defect: inbox DTO lacks that field; search label must promise only supported fields.

### 4.2 Staff Assignment queue

Primary task: identify orders needing two staff selections. Current two-panel queue already groups assignment states, but assigned non-terminal rows occupy comparable attention, there is no local search/sort and list metadata is visually concatenated. Zero on an errored/loading queue can be mistaken for a clear workload.

Proposed: `Needs assignment (n)` default tab, `Assigned (n)` secondary tab; local code/route/mode search; requested-departure and code sorting with explicit direction. Counts show loading/unavailable instead of zero before successful fetch. Assigned tab means active orders with a saved pair, not completed deliveries. Keep five essential data groups in each compact row; no candidate lookup on list.

### 4.3 Staff Assignment detail

Primary task: choose exactly one candidate for each role and commit both once. Current two candidate groups, native radios and selected pair footer support this well; preserve them. Problems: repeated role instructions/headings, email as wide default column, potential tall candidate lists, selected names far from radio controls on small screens. Read-only state still says “Choose one specialist for each role.”

Proposed: compact order context, two role groups with name + activeOrderCount primary; email secondary identity line or expandable identity when necessary to distinguish names. Preserve ordering, radio semantics, selected pair summary and read-only saved pair. Adjust heading to saved-state wording after persistence. Show an explicit per-role empty message; no auto-select or invented fallback. Mutation success/readback failure and stale refresh failure require a locked reconciliation state with retry GET; do not invite assignment replay or claim saved success before readback. This is a UX correctness requirement for the existing API, not a new assignment lifecycle.

### 4.4 Route Review queue

Primary task: open a submitted plan and make a decision. Eight columns plus repeated status text create scanning load. Pending + Locked sections suggest a persistent history API, but real `apiLogisticsRouteReviewService.listReviews()` returns `locked: []`. Preview therefore overstates archive capability. Real summary loading also issues per-order detail + order + assignments requests; broadening queue content compounds request cost.

Proposed: pending-only actionable queue with 5 column groups; mode and horses in route/order secondary text; FRC retained as accountable planning owner; submittedAt retained to sort oldest first. Do not render an empty Locked history as if it is complete. After confirmation show actual mutation result on detail and a link to Journeys; reload/history availability must be labelled truthfully. A durable locked/returned review archive requires a new read capability and authorization review, so defer it.

### 4.5 Route Review detail

Primary task: inspect continuity/resources and Confirm & lock or Return with reason. Existing leg expansion and inline confirmation are reusable. Current six-part summary, route table, validation list, staffing rule and decisions compete for attention.

**Correctness of displayed information must precede visual polish:**

- `frontend/lib/logistics-route-review/api-service.ts` maps `validations: []`, `revision: 0`, `customerName: "Customer"`, horse allocation UUIDs into `horseNames`, and staff UUIDs into `fullName`. Those are not validated results or real display names.
- Detail computes `review.validations.every(...)`; empty array resolves true and summary says Passed. `LegRows` independently hardcodes `✓ Passed`. Pending submission implies earlier validation in workflow, but not a present, per-leg returned result. Show “Submitted for LM review; server checks confirmation” unless actual validation results are supplied. Empty validation list is unknown, not pass/fail. Preserve the server confirmation flow; do not create a new business prerequisite that prevents confirmation merely because optional validation metadata is absent.
- UI displays Revision 0 although real adapter invents it. Hide revision unless it is genuinely returned; the source has no supported edit-version UX requirement.
- Module-level `cache` in route-review API adapter is populated after mutations and consulted by `load`; “refreshed from saved server state” may use cache rather than GET. Post-confirmation cached results exist in the same runtime, while reload invokes pending-only detail. Define explicit current-session result vs server refresh; do not promise durable review history.

Proposed default: order route + plan state + departure, compact ordered legs, review/return decision area. Expand a leg for capacity/allocations/checkpoint definitions/AIR provider and reference. A collapsed Additional details section may contain submittedAt/reviewedAt/lockedAt and existing identity metadata; no fabricated customer name or revision. Keep mandatory safety/lock warning beside Confirm. Staffing results stay visible after successful readback, with IDs labelled as IDs when display-name lookup is unavailable. Never add manual execution-staff picker.

### 4.6 Tracking queue

Primary task: find an existing trackable journey. Current real API, order-code search, refresh, statuses and detail link are useful. Missing status tabs mean completed deliveries compete with work in progress; created date appears in every row even though it rarely drives monitoring. The title description suggests all APPROVED Orders but server requires approved Route Plan too.

Proposed: default `Active journeys` (READY_TO_SHIP + IN_PROGRESS), secondary `Delivered`, optional `Other trackable` for returned APPROVED records with an approved plan. These are view groups, not new status values. Scope copy: “Orders with an approved Route Plan.” Keep precise status on every row; client search can extend to route/mode fields already returned. Do not claim global Order search. Show unfiltered empty vs no filter matches differently. Preview limitation remains explicit; do not fabricate a tracking list to make dashboard look populated.

### 4.7 Tracking detail

Primary task: see current progress, then inspect a Vehicle/leg when necessary. Existing summary, leg overview, current/READY leg auto-expansion and collapsed finished/upcoming legs already implement progressive disclosure well. Keep this improvement.

Remaining load: all Vehicles, checkpoint evidence and contacts inside an expanded multi-Vehicle leg can still be long. Show each Vehicle's label/status/horse count first; expand Vehicle details for named Horses, reached checkpoints, staff contacts and evidence links. Preserve independent per-Vehicle progression; never infer synchronized arrival. `updatedAt` is computed from event times, not HTTP fetch time; label “Latest recorded event”, with a separate fetched timestamp if added. Refresh is manual, no auto-sync indicator. Proof events exist, but do not promise full PoD/photo detail when current view model only supplies event labels/timestamps. ROAD final welfare collection currently loses per-Vehicle identity in the leg-level view model; any association label needs original DTO scope retained, not guessed from array order.

### Responsive and interaction observations

Source includes existing breakpoints for summary grids, nav wrapping, action stacking, horizontal table wrappers, assignment panels and journey details (see `globals.css` assignment/route-review sections and `journey-tracking.css` 900/540px). This is source-verified responsive behavior, not device-tested in this audit. Tiny route-review text (~.61–.74rem), many table fields and stacked summary groups are likely readability issues. Wider spacing alone will not solve it: remove redundant columns and use readable minimum body sizes. Confirmation dialogs have aria roles but focus trap/initial focus/Escape/return-focus are not evidenced by these component implementations; verify and complete in implementation.

## 5. Proposed navigation and information architecture

| Proposed entry | Route proposal | Default / primary action | Secondary detail, filters and relationships |
| --- | --- | --- | --- |
| Overview | New `/logistics/overview`; keep login destination `/logistics` until separately approved | 3 LM action counts + action queue; Open corresponding work item | One small scope-labelled journey-status chart; link to each existing queue, no mutation buttons |
| Orders & quotations | Existing `/logistics` Submitted tab; `/logistics/tracking` Journeys tab | Submitted: select/review/prepare; Journeys: View tracking | Search only available data; status/mode/departure sort as supported; don't advertise unsupported all-orders archive |
| Staff assignment | Existing queue and detail routes | Needs assignment tab → choose TS/FRC → confirm pair | Assigned tab, saved pair, candidate identity on demand |
| Route reviews | Existing queue and detail routes | Pending reviews → inspect → Confirm/Return | Current-session decision result; durable history deferred; journey link after confirmed result |

No standalone Pending Actions, Shipment Monitoring or Exceptions page: those responsibilities are represented by Overview action links and Journeys. Existing URLs stay valid; back navigation returns to the initiating list/tab and can preserve filter/search in URL. Shared header: brand left, role/sign-out right, navigation centrally placed on wide screens, wrapping/scrollable navigation without overlap on narrow screens. Consolidate duplicate headers into existing LM frame rather than redesigning auth.

Every list: labelled loading, successful-empty, filtered-empty, forbidden and error states. On refresh failure, previous results are visibly stale and not counted as freshly verified. Retry reads per panel. Overview partial failure must leave independent panels usable. Logout/expired session uses existing authentication path. No fallback to fixtures in authenticated production.

### Wireframes

```text
OVERVIEW — /logistics/overview
[Logo + Brand]   Overview | Orders | Staff | Route reviews   [LM | Sign out]
Logistics overview                                  [Refresh]
[Submitted: n]       [Needs assignment: n]       [Route reviews: n]
Each tile links to its existing queue; unavailable count is '--'.
+------------------------------------+--------------------------------+
| Pending queue selector + actions   | Trackable orders by status     |
| Order + route + Open action        | READY / IN_PROGRESS / DELIVERED|
+------------------------------------+--------------------------------+
Pending actions: [Submitted | Assign staff | Route reviews]
Order       Route                 Relevant date          [Open]
... show selected queue only; do not sum overlapping domains ...
```

```text
ORDERS & QUOTATIONS
[Submitted] [Journeys]                              [Refresh]
+----------------------+----------------------------------------------+
| Search order/route    | Order + status + route       [Prepare quote] |
| Order / route        | Mode | departure | horses        [Reject]    |
| mode + horses + date | Delivery contact | exact requirements        |
| Selected order ...   | Quotation state  [Edit draft / saved result] |
| ...                  | Editor expanded only during quotation work   |
+----------------------+----------------------------------------------+
```

```text
STAFF ASSIGNMENT                   ROUTE REVIEWS
[Needs assignment] [Assigned]      Pending route plans [Refresh]
[Search] [Sort departure]          [Search] [Sort submitted]
Order | Route/meta | Action        Order | Route/meta | Departure | FRC
...                               Submitted | [Review]
Detail:                           Detail:
Order/route/departure              Order/plan-state/departure
[TS candidates] [FRC candidates]   Ordered legs [Expand]
Name + active orders              Expanded allocations/AIR/checkpoints
[selected pair] [Assign staff]    [Return + reason] [Confirm & lock]
```

```text
JOURNEYS
[Active journeys] [Delivered] [Other trackable]
[Search code/route] [Status] [Mode] [Sort departure] [Refresh]
Order/status | Route + mode | Requested departure | Horses | [Track]
Detail: Order status / latest recorded event / leg overview
> Completed leg (collapsed)
v In-progress leg
  Vehicle/status/horses count [Details]
  > contacts, named Horses, reached checkpoint evidence
> Upcoming leg (collapsed)
```

## 6. Dashboard KPI and chart specifications

Do not call queue counts “urgent” or “overdue”: no agreed SLA. Earliest requested departure or oldest submission is an explicit sort choice, not a computed priority policy. Overview initial scope is whole returned collections, not a shared date-filtered analytics universe.

| KPI | Business question / exact calculation | Source | Filters, action and feasibility |
| --- | --- | --- | --- |
| Submitted requests | How many requests can LM review? Count SUBMITTED inbox rows | GET orders/inbox?status=SUBMITTED | No default date filter; tile opens Submitted. Existing API, FE-only |
| Needs staff assignment | How many APPROVED orders lack required pair? Count NEEDS_ASSIGNMENT rows | assignment-inbox?state=NEEDS_ASSIGNMENT | Opens assignment queue. Existing API; don't derive from all APPROVED orders |
| Pending route reviews | How many plans await LM decision? Count pending review inbox records | GET lm/route-plan-reviews | Opens pending list. Use inbox count before costly detail enrichment; do not count cached returned/locked result |

Limit default to those three KPI tiles. In-progress/ready counts belong to the journey-status chart or Journeys tabs rather than more metric cards.

| Visualization | Business question | Source and calculation | Type / filter / action | Feasibility and limit |
| --- | --- | --- | --- | --- |
| V1 Pending actions by queue — removed | The same question is already answered by three action tiles | Exactly duplicates the three KPI counts | Keep compact clickable KPI tiles; no second chart | No implementation planned |
| V2 Trackable orders by status | How is the returned trackable cohort distributed? | GET lm/tracking-orders; group unique orderId by actual status. READY_TO_SHIP / IN_PROGRESS / DELIVERED, plus APPROVED only when present | Small horizontal distribution bars, no pie + duplicate bar. Optional transport-mode filter; select bar opens Journeys with matching status | FE-only; label explicitly “Trackable orders with approved Route Plan.” Not all Orders. A failure is Unavailable, not 0% |
| V3 Delivered volume over time (optional follow-up) | How many returned tracked deliveries were recorded in a period? | Same tracking list, DELIVERED with non-null deliveredAt; day/week buckets; count orders once. Display excluded missing timestamp count | Simple weekly columns plus data table, date/mode filter; opens Delivered rows in range | Existing fields permit **cohort-limited volume**, not all-orders completion rate, on-time performance or historical status transitions. Defer until action tiles/V2 prove useful; default to one chart |

No revenue forecast, fleet utilization, staff performance ranking, delay/exception rate, GPS or real-time status metric is justified by current LM contracts. System-wide order distribution (including QUOTATION_SENT/CANCELLED/REJECTED) needs a separately scoped LM read/aggregate contract. Approved status alone cannot identify document phase vs awaiting payment vs FRC planning; each requires data the summary queues do not consistently return. Avoid N+1 detail fetches for dashboard analytics.

## 7. Status-based management design

| Domain / raw state | UI mapping / management group | LM behavior and invariant |
| --- | --- | --- |
| Order DRAFT | Customer-only draft, outside LM submitted queue | No LM edit/submit |
| Order SUBMITTED | Submitted requests | Prepare/save DRAFT quotation; Send → QUOTATION_SENT; Reject + reason → REJECTED |
| Quotation DRAFT / SENT | Quotation state in order detail, distinct from Order status | Editing DRAFT only; SENT immutable. No PENDING_QUOTATION/ACCEPTED/revision workflow |
| Order QUOTATION_SENT | Awaiting Customer deposit in lifecycle explanation | No current all-status LM queue; cannot add functional tab with empty invented data. Deposit webhook → APPROVED |
| Order APPROVED + missing staff | Needs assignment, using assignment API | Exactly one ACTIVE TS and FRC in one action |
| Assignment ASSIGNED | Assigned non-terminal queue | Saved pair read-only; not delivered, not reassignment |
| Route Plan DRAFT / RETURNED | FRC responsibility; returned result shown only when returned by existing detail/mutation | LM does not edit route; no complete RETURNED archive API |
| Route Plan PENDING_LM_REVIEW | Pending route reviews | LM Confirm/Return. Return reason required; Confirm locks route and automatic execution staffing precedes READY_TO_SHIP |
| Route Plan APPROVED | Locked plan; separate from Order APPROVED | Show persisted result; expose no reopen or manual Driver/Escort assignment |
| Order READY_TO_SHIP / IN_PROGRESS | Active journeys view group; raw status visible | Read-only tracking. First leg starts → IN_PROGRESS |
| Order DELIVERED | Delivered journey tab | Only after final handover aggregation; terminal |
| Order REJECTED / CANCELLED | Terminal lifecycle exits; no complete LM history API | Do not fabricate archive from missing records |
| RouteLeg PLANNED / READY / IN_PROGRESS / COMPLETED | Mapper uses UPCOMING / READY / IN_PROGRESS / COMPLETED | UPCOMING is a display label for PLANNED, not backend enum. N+1 unlock follows completion |
| Execution NOT_STARTED / IN_PROGRESS / DESTINATION / COMPLETED | Existing Vehicle mapper shows READY/UPCOMING, IN_PROGRESS, IN_PROGRESS, COMPLETED | DESTINATION is not proof of delivery. Final ROAD requires each Vehicle PoD; final AIR one PoD. Do not infer DELIVERED from welfare alone |

Filters are independent: Order status, assignment state and Route Plan status never share a generic Status filter without explicit domain context. A chart's cohort filter must not silently change action counts from other APIs. No Delayed/Blocked/At Risk badges unless a later approved contract defines them. Runtime request/validation errors are inline errors, not business lifecycle statuses.

## 8. Management table / list recommendations

| Surface | Keep in default columns/groups | Remove from default or combine | Move to detail | Primary row action / secondary actions |
| --- | --- | --- | --- | --- |
| Submitted inbox | Order + Submitted badge; route; horses/mode; received date if provided | Redundant Submitted label per metadata line; no contact/requirements in list | Full contact, exact notes, departure and quote breakdown | Select order / refresh; Reject only selected detail |
| Assignment queue | Order; route with mode/horse count; requested departure; assignment state; action | Duplicate state instruction and simultaneous assigned table by default | Candidate identities/counts and saved pair/assignedAt | Assign staff or View assignment / search and sort |
| Candidate groups | Select; staff name + identity disambiguation; activeOrderCount | Repeated role column (group already defines role), long email-wide column | Full email when needed; selected identity remains inspectable | Radio selection / no auto-pick or reassignment |
| Route Review queue | Order; route with mode/horses; requested departure; assigned FRC; submittedAt; Review | Standalone Horses and Mode columns; repeated pending text; false locked-history table | Checkpoints, full schedule, allocations, AIR provider/reference, result timestamps | Review / search, oldest-submitted sort |
| Route legs in review | Sequence/type; endpoints; planned times; vehicle count or AIR capacity; Details | Hardcoded Passed column and duplicated status narrative | Per-Vehicle horse allocations, ordered checkpoints, staff result, AIR reference | Expand leg / no edit |
| Tracking orders | Order + actual status; route with mode; requested departure; horse count; Track | Created date by default; duplicated generic mode badge; delivery date can be secondary within Delivered tab | Event history, Vehicles, contacts, evidence and recorded delivery time | View tracking / status/mode/search/sort/refresh |
| Vehicles within tracking | Vehicle label, execution display state, horse count | All checkpoint notes and contacts repeated by default | Named Horses, contacts, reached evidence links, detailed progression | Expand Vehicle / view existing evidence link |

Maintain visible column headings, semantic table headers and meaningful row action names. On mobile turn essential groups into stacked rows or a labelled scroll region; do not hide primary actions or irreversible-action warnings. A route must remain readable without hover-only tooltips.

## 9. Progressive disclosure strategy

1. **Level 1 Overview:** three domain-specific action counts, one modest chart and one selected action queue. No recipient details, pricing editor, staff email lists or photo grid.
2. **Level 2 Lists:** code/route/status/date + one meaningful action. State tabs/search/sort above rows; preserve selection/filter after return and refresh.
3. **Level 3 Details:** business context needed for current decision first. Quote editor is contextual; route legs/Vehicle evidence expand on demand; contacts and genuine audit metadata are available inside relevant detail.

Special requirements remain the exact stored string and visible when reviewing a submitted request; never generate explanatory horse-safety text. Return/rejection reasons, validation failures, confirm warning, selected assignment pair and mutation reconciliation messages cannot be collapsed away. `Additional details` appears only when optional data actually exists. No placeholder section for a missing field.

## 10. Implementation feasibility matrix

Complexity is relative implementation effort, not a delivery promise. Impact refers to LM usability. All recommendations remain subject to approval; no code is changed by this report.

| Improvement | Affected routes/components | Reuse / FE work | Backend need | Complexity / impact / main risk |
| --- | --- | --- | --- | --- |
| Honest review metadata and validation labels | route-review detail, `api-service.ts`, `types.ts` | Distinguish absent metadata; remove hardcoded pass/revision/name claims, label IDs; preserve server decision validation | None to stop false claims; richer validations/names require separately inspected read data or contract | Small–medium / very high / empty array must not imply pass or block valid workflow |
| Truthful refresh + mutation reconciliation | review and assignment detail/services | Separate read refresh from mutation result cache; synchronous in-flight guard; lock unconfirmed outcome, read-only recovery | Existing GET/POST; review GET is pending-only, so post-lock durable readback/history has a real contract limitation | Medium / very high / mutation replay or treating cached result as server readback |
| Shared LM shell/navigation | `/logistics`, frame, JourneyTrackingView, CSS | Existing frame/BrandMark; central active tabs and breadcrumbs; preserve Customer shared component behavior | None | Medium / high / route/auth/preview regressions |
| Action-first assignment/review queues | two queue pages | Tabs, client filters/sort; loading/error counts; hide unsupported archive | Existing arrays sufficient; durable review history needs new authorized API | Small–medium / high / confusing assigned vs terminal history |
| Compact quotation and independent retry | `/logistics`, quotation section | Existing editor/dialogs/handlers; explicit expand state; real quote state/error | None | Medium / high / collapsing controls must preserve drafts and confirmation validation |
| Journeys filters and compact rows | `/logistics/tracking` | Existing list/search/refresh; route/mode/status filters; source-labelled cohort | None for loaded list; general LM archive requires new API | Small / high / raw scope vs all-orders wording |
| Overview + action tiles/V2 | proposed overview + service reads | New read aggregation hook/view; inbox counts, partial error handling; semantic CSS bars, deep links | None for scoped metrics; full-state analytics requires new aggregate contract | Medium / high / N+1 reads, overlapping counts, sequential fetch inconsistency |
| Deeper Vehicle disclosure | JourneyTrackingView and CSS | Existing native details pattern; retain all data and LM/Customer permissions | None for currently mapped fields; precise ROAD final-welfare linkage needs mapper retain existing DTO scope | Small–medium / medium / accidentally hiding mandatory milestone evidence |
| Accessible/consistent interactions | LM pages, CSS, dialogs | Focus management, keyboard tabs/disclosures, scoped tokens, meaningful labels, status text | None | Medium / high / global CSS affecting Customer/other roles |
| Optional delivery trend | Overview | Group returned deliveredAt; accessible table equivalent | None for cohort-limited volume; complete history requires read contract | Small / low–medium / misleading denominator/history claims |

Preferred architecture: extend existing LM shell and existing services; separate read-only dashboard aggregation from mutation forms. No global state library, general entity-management framework or chart dependency. Keep network work proportional: review KPI count can use inbox summary; avoid `listReviews()` enrichment solely to count. Source panels need independent error boundaries/states and read timestamps. Display last fetched time separately from latest journey-event timestamp. Backend authorization remains authoritative; FE controls do not grant capabilities.

## 11. Prioritized roadmap

### P0 — Critical usability and truthfulness

1. Fix unsupported claims in Route Review: Passed, Revision 0, customer/staff/horse display names, durable Locked results and server refresh wording. Record pending-only detail limitation explicitly; do not expand contract casually.
2. Add unconfirmed-mutation recovery UX to assignment/review and independent quotation read retry; keep failed reads distinct from valid empty states. Preserve current business transitions and confirmation requirements.
3. Phase 0 giữ nguyên navigation/layout. Shared shell/domain labels/readable list redesign chuyển Phase 1; giữ submitted master–detail và tracking leg disclosure hiện có.

### P1 — Dashboard and status organization

4. Default assignment to Needs assignment; compact pending Route Reviews; add client filters/sort and preserve query state.
5. Consolidate Orders/Journeys entry points using existing URLs; add actual-status journey tabs and explicit cohort copy.
6. Standardize common shell/navigation and add Overview with three queue tiles and V2 after honest source states are established. Use existing APIs; API failures must not flatten counts to zero.

### P2 — Polish and optional follow-up

7. Vehicle-level disclosure, responsive density/focus refinements and browser regression coverage for shared LM/Customer tracking.
8. Only after usage feedback, consider cohort-limited delivered trend. Durable locked/returned history and system-wide analytics require separate contract/spec approval; not part of default redesign implementation.

Recommended order: P0 truthfulness/recovery → common shell → queue tabs/tables → Journeys → Overview → optional refinements. Chart implementation should not precede accurate state/source modelling.

## 12. Proposed acceptance criteria

### AC-A — Scope, authorization and truthful labels

- Non-LM users cannot enter authenticated LM views; direct URLs/API authorization remain enforced. Preview access requires existing development guard and is visibly labelled.
- Empty/missing validation metadata never renders Passed/Failed; no per-leg green tick without its actual source. A confirmed earlier validation may be described as workflow context, not a freshly returned result.
- API IDs are labelled identifiers; no UUID displayed as a staff/horse name, invented revision or fabricated customer identity.
- Locked history is absent or explicitly unavailable when real API only supplies pending; return/reload never implies a durable archive exists.
- ROUTE_PLAN APPROVED, ORDER APPROVED, assignment ASSIGNED and execution COMPLETED stay distinct; no new status enum or LM business action is introduced.

### AC-B — Submitted requests and quotation

- Search filters only loaded supported fields; selecting another order cannot show previous order's quotation as current.
- Route, mode, departure, horse count, contact and stored special requirements remain available for review; quotation editor expands contextually without dropping entered draft values.
- Quotation load error has a read-only retry path and does not assert Not started. Prepare appears once when the state supports creation; Save/Send/Reject retain existing validation/confirmation.
- Send success removes the SUBMITTED row according to persisted state; UI never exposes edits to a SENT quotation or direct Order approval.

### AC-C — Staff assignment

- Needs assignment is default; Assigned shows assigned non-terminal scope. Loaded count/filter count/unknown count are visually distinct.
- Exactly one TS and one FRC must be selected; names/identity and activeOrderCount stay inspectable; no automatic decision or reassignment control.
- Duplicate clicks make one mutation; after uncertain persistence/readback only a read recovery is available until reconciled. Successful readback renders the saved pair read-only.
- Candidate-empty, forbidden, request failure and genuine queue-empty states have distinct messages and appropriate next action.

### AC-D — Route review

- Default list shows pending reviews with meaningful submitted/departure fields and one Review action; mode/horses do not require separate wide columns.
- Expanded leg retains schedule, allocation/capacity/checkpoint/AIR details required for review. LM cannot edit planning or manually select execution staff.
- Return requires a reason; Confirm explains permanent lock and automatic staffing. Controls are locked during mutation/reconciliation; read retries never replay Confirm/Return.
- Refresh actually invokes available server read when it claims to do so. A cached mutation response is labelled current-session saved result; pending-only GET limitations are handled without silently pretending to reload locked state.

### AC-E — Tracking and information hierarchy

- Active/Delivered/Other trackable tabs map exactly to the stated raw statuses; count semantics exclude neither failed requests nor unmapped data silently.
- Overview/list/body introduce no GPS, delayed status, risk score, live-sync indicator, LM notification feed or role-inappropriate mutation.
- Only current/READY legs auto-expand initially; every Vehicle remains independently inspectable. Unreached checkpoint evidence is not rendered.
- Latest recorded event and fetch time have distinct labels. Customer tracking still has its own notification handling; LM does not receive the Customer notification sidebar.
- Browser checks cover long routes, multiple Vehicles, empty checkpoints, 360px/768px/1440px layouts and keyboard navigation; no hidden primary action or page-level horizontal overflow caused by controls.

### AC-F — Overview and charts

- Three action tiles equal their successfully fetched source collection counts. Failed source shows Unavailable and retry; other tiles continue to work.
- Three action tiles show distinct queues without an all-orders total/percentage. No duplicate Pending Actions chart. V2 includes only tracking API cohort and states that scope next to chart.
- Clicking each tile/bar opens the matching existing queue/status filter; a zero or fully empty dataset renders an honest empty state.
- Repeated source reads replace stale results after success; failed refresh marks retained values stale and provides fetched time. No real-time guarantee is displayed.
- One default chart; each includes text values/accessible equivalent and works without color discrimination or pointer-only interaction.

### AC-G — Implementation discipline

- Any later implementation stays scoped to approved FE routes/components; no dependencies, schema or business-rule changes required for P0/P1 scoped plan.
- Targeted service/page tests cover count scope, partial errors, filter semantics, unknown validation data and no-replay reconciliation. Existing relevant auth/quotation/assignment/review/tracking checks plus lint/type/build pass.
- No acceptance claim is based only on preview fixtures; test real service boundaries using representative DTOs, including absent optional fields and error responses.

## 13. Decisions and remaining limits

PO review choices: approve the 4-item navigation/Orders–Journeys consolidation; decide whether Overview becomes initial landing later; accept pending-only Route Reviews instead of promising archive. These are presentation choices, not unresolved business rules. No backend coordination is required to approve and implement the FE-only subset.

Pending-only route-review GET is the main contract constraint for cross-reload confirmed/returned detail. A durable review-result view cannot be promised by styling alone. If needed, specify an authorized history/read contract separately; do not weaken server gates. System-wide Order statistics are similarly deferred. Business_Rules BR-20/21 unconfirmed escalations remain excluded. This report has not measured real response latency, real counts, keyboard/browser behavior or production bundle leakage; those claims require later verification.

### Source index for reviewers

- `frontend/app/logistics/page.tsx`: inbox fetch ~208, selected-detail/quotation fetch ~256, header/inbox/detail/quote rendering ~439–493.
- `frontend/app/logistics/assignments/page.tsx`; `assignments/[orderId]/page.tsx`: queue groups, radio candidate selection, readback and saved-pair UI.
- `frontend/app/logistics/route-reviews/page.tsx`; `route-reviews/[orderId]/page.tsx`: pending/locked tables; `allValid` ~97; summary ~120; revision ~133; `LegRows` hardcoded pass ~164 onward.
- `frontend/lib/logistics-route-review/api-service.ts`: mapper defaults, list enrichment, `locked: []`, mutation cache; `types.ts`: distinct RoutePlan/Order types and complete-staffing helper.
- `frontend/app/logistics/tracking/page.tsx`: real-only list, code search, error/preview behavior.
- `frontend/components/AssignmentWorkspaceFrame.tsx`, `JourneyTrackingView.tsx`, `BrandMark.tsx`, `journey-tracking.css`, `frontend/app/globals.css`: shared shell/role UI, disclosure and responsive styling.
- `frontend/lib/staff-assignment/{types,api-service,service,use-logistics-access}.ts`; `lib/logistics-tracking/service.ts`; `lib/journey-tracking/{types,service}.ts`: DTO fields, preview selection, authorization entry checks and tracking mappings.
- `backend/src/main/java/com/horsetransport/order/{TransportOrderController,TransportOrderService,OrderStaffAssignmentController,OrderStaffAssignmentService,OrderStatus}.java`.
- `backend/src/main/java/com/horsetransport/route/{LmRoutePlanReviewController,RoutePlanService,RoutePlanStatus,RouteLegStatus}.java`.
- `backend/src/main/java/com/horsetransport/tracking/{LogisticsTrackingOrderController,LogisticsTrackingOrderService,JourneyTrackingController,JourneyTrackingResponse}.java`; `security/SecurityConfig.java`.
- `frontend/package.json`; official DOCX sources and `docs/erd/erd.dbml` listed in §1.

## Phase 0 implementation manifest and verification

Production source changed:
- `frontend/app/logistics/page.tsx`
- `frontend/app/logistics/assignments/[orderId]/page.tsx`
- `frontend/app/logistics/route-reviews/page.tsx`
- `frontend/app/logistics/route-reviews/[orderId]/page.tsx`
- `frontend/lib/logistics-route-review/types.ts`
- `frontend/lib/logistics-route-review/api-service.ts`
- `frontend/lib/logistics-route-review/mock-service.ts`

Tests/fixtures added:
- `frontend/app/logistics/page.test.tsx`
- `frontend/app/logistics/assignments/[orderId]/page.test.tsx`
- `frontend/app/logistics/route-reviews/page.test.tsx`
- `frontend/app/logistics/route-reviews/[orderId]/page.test.tsx`
- `frontend/lib/logistics-route-review/api-service.test.ts`
- `frontend/lib/staff-assignment/use-logistics-access.test.tsx`
- `frontend/tests/lm-phase0-fixtures.ts`

Documentation: this report and `docs/project-context/CURRENT_STATE.md`.

Verification: full Vitest suite 267/267 passed (38 files); ESLint and production
build (including generated Next TypeScript validation) passed. Focused tests
exercise real adapter requests and page service boundaries: missing metadata,
explicit validation failure, Confirm/Return, labelled IDs, single-flight mutation,
repeated failed GET recovery, stale assignment, quotation not-found versus request
failure, immutable SENT quotation, and LM/production-preview authorization.
No real Backend E2E, database mutation or browser workflow was executed in this
Phase 0. New chart/UI architecture and independent Backend security testing are
outside this verification. Existing Backend authorization/validation is preserved.

**Stop point:** Phase 0 implementation only. Phase 1/2 require separate PO approval. No commit/push.
