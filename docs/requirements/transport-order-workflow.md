# Transport Order Workflow

## Mục đích

Tài liệu này định nghĩa state transition chính thức của Transport Order trong phạm vi MVP của Horse Transport System.

Tài liệu này là nguồn tham chiếu nghiệp vụ cho Senior BA, Scrum Master, Solution Architect, Developer và QA.

## Phạm vi

- Áp dụng cho Transport Order trong MVP.
- Customer được phép chỉnh sửa Order khi Order ở trạng thái `DRAFT`.
- Từ trạng thái `SUBMITTED`, Customer không được chỉnh sửa trực tiếp Order.
- Nếu cần thay đổi sau khi đã `SUBMITTED`, việc xử lý phải tuân theo workflow được định nghĩa trong tài liệu này.
- Incident Management không thuộc phạm vi MVP hiện tại.

## State Transition

| From | Action / Event | To  | Actor | Preconditions | Transition Type |
| ---- | -------------- | --- | ----- | ------------- | --------------- |
|      |                |     |       |               |                 |

## Cancellation Rules

TBD

## Rejection Rules

TBD

## Revision Rules

TBD

## Open Questions

TBD
