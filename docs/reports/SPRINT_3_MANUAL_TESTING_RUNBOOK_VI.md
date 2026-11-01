# Sprint 3 — Runbook manual testing

## 1. Phạm vi đã xác nhận

Runbook này chỉ kiểm tra các requirement Sprint 3 đã được phê duyệt:

- FR-015: thực thi RouteLeg theo thứ tự.
- FR-016: ROAD Vehicle execution, checkpoint arrival và welfare theo từng Vehicle.
- FR-017: AIR execution thủ công/mô phỏng bởi Escort.
- FR-018: Proof of Delivery và chuyển Order sang `DELIVERED`.
- FR-019: LM/Customer journey tracking và Customer notifications.
- FR-020: status audit cho các entity thuộc phạm vi BR-19.

Route planning, LM route approval và automatic execution staffing là điều kiện đầu vào từ
FR-010–FR-014 (Sprint 2), không phải scenario lifecycle chính của Sprint 3. Dataset manual
được đề xuất bắt đầu tại `READY_TO_SHIP`, với Route Plan đã `APPROVED` và staffing đã
persist, để người kiểm thử chỉ tạo các mutation Sprint 3 bằng UI.

Ngoài phạm vi: GPS/live map, airline API/booking, pilot/airline staff, manual Driver/Escort
assignment, mid-trip reassignment, vehicle CRUD, recipient login/OTP/signature và manual
Customer notification.

## 2. Dataset đề xuất: `S3MANUAL-20261101`

### Fixture A — `S3MANUAL-20261101-AIR-MVR`

- Order `READY_TO_SHIP`, hai Horse mới dành riêng cho manual QA.
- RouteLeg 1: AIR `READY`, non-final; một AIR execution `NOT_STARTED`, Escort One.
- RouteLeg 2: ROAD `PLANNED`, final; hai Vehicle mới, mỗi Vehicle một Horse.
- Hai ROAD executions `NOT_STARTED`: Driver/Escort One và Driver/Escort Two.
- Một shared ROAD checkpoint; arrival và welfare vẫn riêng theo từng Vehicle.
- Lịch dự kiến: AIR 01/03/2099 08:00–12:00; ROAD 13:00–18:00.

### Fixture B — `S3MANUAL-20261101-AIR-FINAL`

- Order `READY_TO_SHIP`, một Horse mới dành riêng cho manual QA.
- Một final AIR RouteLeg `READY`; AIR execution `NOT_STARTED`, Escort One.
- Lịch dự kiến: 02/03/2099 08:00–12:00.

### Namespace và số record dự kiến

| Nhóm | Fixture A | Fixture B | Tổng |
| --- | ---: | ---: | ---: |
| Horse | 2 | 1 | 3 |
| Order | 1 | 1 | 2 |
| Order–Horse | 2 | 1 | 3 |
| Vehicle | 2 | 0 | 2 |
| Route Plan | 1 | 1 | 2 |
| RouteLeg | 2 | 1 | 3 |
| ROAD Vehicle | 2 | 0 | 2 |
| ROAD Vehicle–Horse | 2 | 0 | 2 |
| ROAD execution | 2 | 0 | 2 |
| AIR execution | 1 | 1 | 2 |
| Checkpoint | 1 | 0 | 1 |
| **Tổng** | **18** | **6** | **24** |

ID dự kiến dùng namespace `d6`: Horse `d600…`, Order `d610…`, Order–Horse
`d620…`, Vehicle `d630…`, Route Plan `d640…`, RouteLeg `d650…`, ROAD Vehicle
`d660…`, allocation `d670…`, ROAD execution `d680…`, AIR execution `d690…`,
checkpoint `d6a0…`. Business keys dùng prefix chính xác `S3MANUAL-20261101-`;
plate number là `S3MANUAL-20261101-AIR-MVR-01` và
`S3MANUAL-20261101-AIR-MVR-02`.

Preflight read-only ngày 01/11/2026: 0 collision cho ID/business key; sáu tài khoản
Customer/LM/Driver 1–2/Escort 1–2 đều `ACTIVE` và đúng role; 0 staffing overlap tại
các interval trên. Hai Vehicle là record mới nên không tái sử dụng allocation của fixture cũ.

Không tạo trực tiếp arrival, welfare, PoD, notification hoặc status audit. Các record này chỉ
được sinh bởi UI/API nghiệp vụ trong lúc chủ dự án tự kiểm thử.

## 3. Role, account identifier và màn hình

| Role | Account identifier | Màn hình |
| --- | --- | --- |
| Driver One | `driver1.s3demo@example.com` | `/driver` |
| Driver Two | `driver2.s3demo@example.com` | `/driver` |
| Escort One | `escort1.s3demo@example.com` | `/escort` |
| Escort Two | `escort2.s3demo@example.com` | `/escort` |
| Logistics Manager | `lm.s3demo@example.com` | `/logistics/tracking` |
| Customer | `customer.s3demo@example.com` | `/customer` |

Đăng xuất trước khi đổi role. Dùng secret runtime đã được chủ dự án phê duyệt; không lưu
password/JWT trong tài liệu, source, ảnh chụp hoặc báo cáo.

## 4. Khởi động môi trường

Backend, từ thư mục `backend`:

```powershell
.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=local
```

Frontend, từ thư mục `frontend`:

```powershell
npm run dev
```

Kiểm tra dịch vụ:

```powershell
Test-NetConnection localhost -Port 8080
Test-NetConnection localhost -Port 3000
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8080`
- Không dùng `preview=1`.
- Chỉ chạy read-only SQL bằng datasource local đã được target guard xác minh; không in URL,
  username, password hoặc token.

## 5. Checklist manual — Fixture A

**Kết quả cuối: MANUAL TEST PASS (owner xác nhận trực tiếp qua browser, 01/11/2026).**
Các bước dưới đây được giữ lại để demo hoặc tái kiểm thử có kiểm soát; không replay trên
dataset hiện tại nếu chưa có phê duyệt mới.

### S3M-A-01 — ROAD bị khóa trước khi AIR hoàn tất

- Role: Driver One, sau đó Driver Two.
- URL: `/driver`.
- Điều kiện: AIR `READY`; ROAD `PLANNED`; mọi execution `NOT_STARTED`.
- Thao tác: mở Order `S3MANUAL-20261101-AIR-MVR`; kiểm tra ROAD Vehicle của từng Driver.
- Mong đợi: không có action Start; trạng thái thể hiện chờ RouteLeg trước.
- Xác minh: refresh vẫn giữ trạng thái; không có lifecycle record mới.
- Kết quả: `[x] PASS  [ ] FAIL` — ROAD bị khóa đúng trước khi AIR hoàn tất.

### S3M-A-02 — Start AIR

- Role: Escort One.
- URL: `/escort` → AIR detail.
- Thao tác: bấm **Start AIR execution** một lần.
- Mong đợi: AIR execution và RouteLeg `IN_PROGRESS`; Order `IN_PROGRESS`; action tiếp theo là destination.
- Kết quả: `[x] PASS  [ ] FAIL` — Non-final AIR Start thành công.

### S3M-A-03 — AIR destination và final welfare

- Role: Escort One.
- Thao tác: Record destination; xác nhận chưa thể Complete khi thiếu welfare; upload một ảnh
  synthetic JPEG/PNG và nhập note; Save AIR welfare.
- Mong đợi: destination timestamp và một AIR final-welfare record được đọc lại; ảnh không chứa PII.
- Kết quả: `[x] PASS  [ ] FAIL` — Destination và final welfare được lưu thành công.

### S3M-A-04 — Complete non-final AIR và mở ROAD

- Role: Escort One, sau đó Driver One/Two đọc lại queue.
- Thao tác: bấm **Complete AIR execution** một lần.
- Mong đợi: AIR execution/leg `COMPLETED`; ROAD chuyển `READY`; Order chưa `DELIVERED`.
- Kết quả: `[x] PASS  [ ] FAIL` — AIR hoàn tất và ROAD được unlock.

### S3M-A-05 — Start hai ROAD Vehicle độc lập

- Role: Driver One rồi Driver Two.
- Thao tác: mỗi Driver mở đúng Vehicle và bấm **Start my vehicle**.
- Mong đợi: cả hai execution `IN_PROGRESS`; Start Vehicle 1 không tự Start Vehicle 2.
- Kết quả: `[x] PASS  [ ] FAIL` — Hai Driver Start độc lập.

### S3M-A-06 — Hai checkpoint arrivals

- Role: Driver One rồi Driver Two.
- Thao tác: mỗi Driver bấm **Confirm checkpoint arrival** cho shared checkpoint.
- Mong đợi: hai arrival timestamp riêng; sau arrival, destination chưa mở cho tới khi checkpoint
  welfare tương ứng được lưu.
- Kết quả: `[x] PASS  [ ] FAIL` — Hai checkpoint arrival độc lập.

### S3M-A-07 — Checkpoint welfare theo từng Vehicle/Horse

- Role: Escort One rồi Escort Two.
- URL: `/escort` → ROAD detail tương ứng.
- Thao tác: upload ảnh synthetic và note riêng cho mỗi Vehicle.
- Mong đợi: mỗi evidence gắn đúng execution, checkpoint và Horse; evidence Vehicle 1 không xuất
  hiện như evidence của Vehicle 2.
- Kết quả: `[x] PASS  [ ] FAIL` — Hai checkpoint welfare đúng Vehicle/Horse.

### S3M-A-08 — Vehicle 1 destination/final welfare không hoàn tất cả leg

- Role: Driver One, sau đó Escort One.
- Thao tác: Driver xác nhận destination; Escort upload final welfare riêng.
- Mong đợi: Vehicle 1 `COMPLETED`; Vehicle 2 và ROAD leg chưa `COMPLETED`; Order chưa `DELIVERED`.
- Kết quả: `[x] PASS  [ ] FAIL` — Vehicle 1 không hoàn tất toàn bộ ROAD leg.

### S3M-A-09 — Vehicle 2 destination/final welfare

- Role: Driver Two, sau đó Escort Two.
- Thao tác: destination rồi final welfare.
- Mong đợi: Vehicle 2 `COMPLETED`; Order vẫn chưa `DELIVERED` khi chưa đủ PoD.
- Kết quả: `[x] PASS  [ ] FAIL` — Vehicle 2 destination/final welfare thành công.

### S3M-A-10 — PoD aggregation

- Role: Escort One rồi Escort Two.
- Thao tác: với từng Vehicle, nhập recipient, ảnh PoD khác ảnh welfare và optional note.
- Mong đợi sau PoD 1: `1/2`, ROAD/Order vẫn `IN_PROGRESS`. Sau PoD 2: `2/2`, ROAD
  `COMPLETED`, Order `DELIVERED`. Không gửi lại request nếu kết quả lần đầu chưa rõ.
- Kết quả: `[x] PASS  [ ] FAIL` — PoD 1 giữ Order `IN_PROGRESS` tại `1/2`; PoD 2
  chuyển handovers sang `2/2`, ROAD RouteLeg `COMPLETED` và Order `DELIVERED`.

### S3M-A-11 — LM/Customer tracking và notifications

- Role: LM tại `/logistics/tracking`; Customer tại `/customer` → **Track journey**.
- Mong đợi: cùng hai RouteLeg, hai Vehicle streams, đúng Horse per Vehicle, checkpoint/final
  welfare, hai PoD events và `DELIVERED`. Customer có notification cho start/checkpoint/welfare/
  destination/leg completion/order delivery; LM không có action lifecycle.
- Kết quả: `[x] PASS  [ ] FAIL` — LM và Customer tracking browser verification PASS.

## 6. Checklist manual — Fixture B

**Kết quả cuối: MANUAL WAIVED BY OWNER — không phải manual PASS.** Fixture này không cần
thực thi hoặc reset. Workflow single-leg final AIR đã PASS authenticated browser E2E trước đó
với `S3QA-AIR-FINAL-001`. Checklist được giữ lại chỉ để demo/tái kiểm thử sau này.

### S3M-B-01 — Final AIR Start → Destination → Welfare

- Role: Escort One tại `/escort` → AIR detail.
- Thao tác: Start, destination, upload final welfare.
- Mong đợi: Order chưa `DELIVERED`; AIR detail hiển thị đúng Horse và evidence đã lưu.
- Kết quả: `[ ] PASS  [ ] FAIL` — `NOT RUN / MANUAL WAIVED`.

### S3M-B-02 — Final AIR không có Complete riêng

- Role: Escort One.
- Mong đợi: sau welfare, UI chỉ mở PoD; không có **Complete AIR execution**.
- Kết quả: `[ ] PASS  [ ] FAIL` — `NOT RUN / MANUAL WAIVED`.

### S3M-B-03 — Final AIR PoD

- Role: Escort One.
- Thao tác: nhập recipient, upload ảnh PoD khác ảnh welfare, optional note, Confirm handover.
- Mong đợi: AIR execution/leg `COMPLETED`; Order `DELIVERED`; PoD riêng với welfare.
- Kết quả: `[ ] PASS  [ ] FAIL` — `NOT RUN / MANUAL WAIVED`.

### S3M-B-04 — LM/Customer tracking

- Role: LM và Customer.
- Mong đợi: Horse `S3 Manual Final Air Cloud` hiển thị trên AIR leg; welfare, PoD,
  events, notifications và `DELIVERED` đầy đủ.
- Kết quả: `[ ] PASS  [ ] FAIL` — `NOT RUN / MANUAL WAIVED`; equivalent browser E2E PASS
  với `S3QA-AIR-FINAL-001`.

## 7. Kiểm tra quyền và fail-closed

### S3M-N-01 — Foreign staff

- Đăng nhập Driver/Escort không được assignment và thử mở URL execution của người còn lại.
- Mong đợi: execution không có trong queue; direct URL trả unavailable/404, không có action.
- Kết quả: `[ ] PASS  [ ] FAIL`

### S3M-N-02 — Missing evidence

- Quan sát trước khi upload checkpoint/final welfare và trước PoD.
- Mong đợi: action tiếp theo bị khóa đúng điều kiện; Order không tự `DELIVERED`.
- Kết quả: `[ ] PASS  [ ] FAIL`

### S3M-N-03 — No stale/duplicate UI mutation

- Sau mỗi action thành công, chờ readback rồi refresh.
- Mong đợi: action đã hoàn tất biến mất hoặc chuyển thành evidence/read-only state. Không cố gửi
  duplicate bằng DevTools/API ngoài UI.
- Kết quả: `[ ] PASS  [ ] FAIL`

### S3M-N-04 — FR-020 read-only audit verification

- Sau khi lifecycle hoàn tất, người có quyền DB chỉ chạy SELECT được review trước.
- Mong đợi: các transition Order/RouteLeg thuộc BR-19 có audit record tương ứng; không kỳ vọng
  audit cho execution, welfare hay PoD vì chúng không thuộc năm entity FR-020.
- Kết quả: `[ ] PASS  [ ] FAIL`

## 8. Quy tắc dừng

- Khi UI báo lỗi nhưng request có thể đã thành công: dừng, refresh/readback trước; không click lại.
- Không sửa lifecycle bằng SQL, không reset fixture và không cleanup trong lúc test.
- Không xóa Cloudinary evidence.
- Dừng scenario tại bug; scenario độc lập còn lại chỉ tiếp tục khi an toàn.
- Ghi lại role, URL, thời điểm, action, HTTP status nếu quan sát được, persisted status và ảnh chụp
  không chứa secret.

## 9. Trạng thái dataset và validation cuối

Ngày 01/11/2026, owner đã phê duyệt và transaction setup commit đúng 24 record. Initial
readback xác nhận Fixture A có 18 record, Fixture B có 6 record, mọi execution `NOT_STARTED`
và chưa có lifecycle evidence trước khi test.

Fixture A đã MANUAL PASS và kết thúc với ROAD RouteLeg `COMPLETED`, Order `DELIVERED`.
Fixture B được owner miễn manual testing và được giữ nguyên; không ghi manual PASS. Final AIR
single-leg tương đương đã PASS browser E2E với `S3QA-AIR-FINAL-001`.

AIR detail parser contract mismatch và AIR-only Horse tracking đã được sửa; regression cùng
LM/Customer browser verification PASS. Không còn tracking defect đã biết trong các scenario
được kiểm thử. Backend non-container tests 423 PASS và Frontend tests 225 PASS; Backend
compile, TypeScript, ESLint và production build PASS. Docker/Testcontainers là
`NOT RUN / ENVIRONMENT BLOCKED` vì Docker daemon không khả dụng; owner quyết định bỏ qua
Docker gate trong lượt finalize này.

Giữ nguyên manual/E2E datasets và evidence. Không replay payment, Route Plan approval hoặc
lifecycle E2E; muốn demo/tái kiểm thử phải dùng checklist trên và có phê duyệt mới phù hợp.
