# Horse Transport System — Quy tắc dành cho AI Agent

## 1. Bối cảnh dự án

Horse Transport System được phát triển theo quy trình Agile Scrum.

GitHub được sử dụng để quản lý:

- Source code
- GitHub Issues
- Product Backlog
- Sprint
- Pull Request và review code

Các Agent phải tuân thủ các quy tắc trong tài liệu này khi làm việc với repository.

---

## 2. Nguồn thông tin chính thức

Trước khi phân tích requirement, lập kế hoạch, thiết kế kiến trúc hoặc implement chức năng, Agent phải đọc các tài liệu liên quan trong thư mục `docs/`.

Thứ tự ưu tiên nguồn thông tin:

1. Business Rules và requirement đã được xác nhận
2. Tài liệu dự án đã được phê duyệt
3. ERD và domain model
4. GitHub Issues đã được phê duyệt
5. Source code hiện tại
6. Assumption của Agent

Agent không được tự biến một suy luận hoặc giả định thành requirement chính thức.

---

## Project Context / Session Handoff

Trước khi thực hiện công việc đáng kể trong dự án, mọi Agent phải:

1. Đọc `docs/project-context/CURRENT_STATE.md`.
2. Dùng `CURRENT_STATE.md` để hiểu phase hiện tại, các review gate đã hoàn tất, công việc hiện tại, công việc deferred/non-blocking và explicit MVP non-scope.
3. Chỉ xem `CURRENT_STATE.md` là tài liệu handoff/resume, **không** xem đây là nguồn requirement chính thức.
4. Đối với business behavior, tuân theo requirements, confirmed workflow, Business Rules và approved architecture chính thức được `CURRENT_STATE.md` tham chiếu.
5. Đọc Skill phù hợp với vai trò trước khi thực hiện công việc role-specific.
6. Tiếp tục từ phần `Current Work` thay vì làm lại discovery đã hoàn tất hoặc mở lại các quyết định đã được giải quyết.
7. Cập nhật `CURRENT_STATE.md` sau các milestone hoặc phase change lớn để máy/session khác có thể tiếp tục mà không cần previous chat history.

---

## 3. Phân loại thông tin

Khi phân tích requirement, Agent phải phân biệt rõ:

### Confirmed

Thông tin được xác nhận trực tiếp bởi:

- Business Rules
- tài liệu dự án
- ERD
- quyết định rõ ràng từ con người

### Assumption

Suy luận hợp lý của Agent nhưng chưa được xác nhận bởi nguồn chính thức.

### Open Question

Thông tin còn thiếu, mơ hồ, mâu thuẫn hoặc cần stakeholder xác nhận.

Agent không được trình bày `Assumption` hoặc `Open Question` như một requirement đã được xác nhận.

---

## 4. Human Approval Gate

Agent phải nhận được sự phê duyệt của con người trước khi:

- tạo GitHub Issue từ Functional Requirement mới được đề xuất
- thay đổi đáng kể requirement đã được phê duyệt
- đưa Product Backlog Item vào một Sprint
- thực hiện quyết định kiến trúc làm thay đổi đáng kể thiết kế hệ thống đã thống nhất

Agent được phép phân tích, đặt câu hỏi và tạo bản nháp trước khi được phê duyệt.

Nếu không xác định rõ đã được phê duyệt hay chưa, phải xem nội dung đó là **chưa được phê duyệt**.

---

## 5. Quy tắc làm việc với GitHub

Khi thao tác với GitHub:

- Ưu tiên sử dụng GitHub CLI (`gh`) khi phù hợp.
- Không được hiển thị hoặc làm lộ authentication token hay secret.
- Không đọc hoặc in giá trị secret từ `.env` vào output.
- Không commit file `.env`.
- Không push trực tiếp vào `main` trừ khi được yêu cầu rõ ràng.
- Không xóa Issue, Project Item, branch hoặc tài nguyên GitHub nếu chưa được yêu cầu rõ ràng.
- Phải kiểm tra tránh tạo Issue trùng lặp.
- Trước thao tác ghi, phải xác nhận đúng repository và GitHub Project.

Khi có thể, thông tin cấu hình GitHub phải được lấy từ environment/configuration thay vì hard-code.

---

## 6. Workflow của Product Backlog

Workflow mặc định:

Backlog → Ready → In Progress → In Review → Done

Ý nghĩa:

- **Backlog**: công việc đã được xác định nhưng chưa cam kết implement.
- **Ready**: requirement đã đủ rõ để có thể đưa vào quá trình phát triển.
- **In Progress**: đang được implement.
- **In Review**: đang review code, test hoặc kiểm tra requirement.
- **Done**: đã hoàn thành theo Acceptance Criteria đã thống nhất.

Không được chuyển một item sang `Done` chỉ vì đã viết xong code.

---

## 7. Vai trò của Agent

Quy trình chi tiết cho từng vai trò được định nghĩa trong:

`.agents/skills/`

Ví dụ:

- `senior-ba` — phân tích requirement và xây dựng Product Backlog
- `scrum-master` — Sprint Planning và quản lý Backlog
- `solution-architect` — thiết kế kiến trúc và technical design

Khi task yêu cầu một vai trò cụ thể, Agent phải đọc và tuân theo `SKILL.md` tương ứng.

Nếu rule trong Skill mâu thuẫn với `AGENTS.md`, ưu tiên `AGENTS.md`.

---

## 8. Quy tắc an toàn khi thay đổi project

Trước khi thay đổi bất kỳ nội dung nào, Agent phải:

1. Đọc các file và tài liệu liên quan.
2. Hiểu trạng thái hiện tại trước khi chỉnh sửa.
3. Không ghi đè các thay đổi không liên quan của người dùng.
4. Ưu tiên các thay đổi nhỏ, rõ ràng và dễ review.
5. Nếu thiếu thông tin, phải báo rõ thay vì tự đoán.

Các thay đổi có tính phá hủy, khó hoàn tác hoặc ảnh hưởng phạm vi lớn phải được con người phê duyệt trước.

---

## 9. Definition of Done

Một công việc chỉ được xem là `Done` khi các requirement liên quan đã được đáp ứng.

Đối với implementation task, thông thường cần:

- implementation hoàn thành
- Acceptance Criteria được đáp ứng
- các test liên quan pass
- không còn blocking issue đã biết
- hoàn thành review nếu workflow yêu cầu

Từng Skill có thể định nghĩa thêm điều kiện hoàn thành riêng cho vai trò đó.
