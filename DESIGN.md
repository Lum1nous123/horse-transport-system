---
name: Horse Transport System
description: Hệ thống hỗ trợ khách hàng quản lý yêu cầu vận chuyển ngựa.
colors:
  primary: "#2878C8"
  primary-hover: "#1F64AA"
  navy: "#15344D"
  ink: "#172B3A"
  body: "#405463"
  muted: "#5C6F7D"
  canvas: "#FFFFFF"
  surface-soft: "#F4F8FB"
  surface-blue: "#EAF4FB"
  border: "#D7E2EA"
  on-primary: "#FFFFFF"
  error: "#B42318"
  success: "#16794B"
typography:
  display:
    fontFamily: "Geist, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "clamp(3rem, 6vw, 5.5rem)"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Geist, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "clamp(2rem, 4vw, 3.5rem)"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Geist, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Geist, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Geist, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
  section: "clamp(64px, 9vw, 112px)"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "14px 22px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.navy}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "13px 21px"
    height: "48px"
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "12px 14px"
    height: "48px"
  top-navigation:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    height: "72px"
---

# Design System: Horse Transport System

## 1. Overview

**Creative North Star: Hành trình rõ ràng, chăm sóc đáng tin cậy.**

Đây là một design system dùng chung cho Landing Page, Login Page và Customer System. Landing Page được phép giàu hình ảnh và có nhịp giới thiệu rộng hơn; Login và các bước trong hệ thống giữ cách trình bày tập trung vào tác vụ. Cả hai vẫn phải nhận diện là cùng một Horse Transport System qua logo, màu sắc, typography và quy tắc thành phần.

Không khí chủ đạo là sáng, thoáng và bình tĩnh: xanh dương tươi làm màu hành động, navy tạo độ vững và nền trắng/xanh xám nhạt giữ nội dung dễ đọc. Hình ảnh lớn về ngựa và hành trình vận chuyển có thể tạo điểm nhấn khi có asset phù hợp; không dùng hình ảnh để ngụ ý đội xe, dịch vụ hay năng lực chưa được xác nhận. Logo hiện có là `frontend/public/logo.jpg`; dùng nguyên asset này, không tự tạo logo thay thế.

Thiết kế tham khảo cảm giác tối giản, phân cấp rõ và hình ảnh nổi bật theo yêu cầu; tài liệu BMW trong `docs/design-reference/` chỉ là tham khảo về cấu trúc trình bày. Không sao chép nhận diện, nội dung hay hình ảnh từ Apple hoặc BMW. Toàn bộ text trên website phải bằng tiếng Anh.

**Đặc điểm chính:**
- Một thương hiệu và một bộ token xuyên suốt trang giới thiệu và giao diện đăng nhập.
- Nền sáng, xanh dương dành cho hành động chính, navy cho tiêu đề và điểm nhấn có trọng lượng.
- Bố cục rộng rãi, thứ bậc chữ rõ; card chỉ dùng khi giúp nhóm thông tin hoặc thao tác.
- Ưu tiên trải nghiệm responsive, focus dễ nhận biết và hỗ trợ `prefers-reduced-motion`.

## 2. Colors

Bảng màu xanh dương mát trên nền trung tính sáng truyền tải sự rõ ràng và tin cậy mà không cần trang trí dày đặc.

### Primary
- **Xanh hành động** (`#2878C8`): CTA chính, liên kết quan trọng và trạng thái lựa chọn hiện hành. Dùng có chủ đích, không làm màu nền trang mặc định.
- **Xanh hành động đậm** (`#1F64AA`): hover/active cho CTA chính.

### Secondary
- **Navy tin cậy** (`#15344D`): tiêu đề, điều hướng và điểm nhấn chữ trên nền sáng.

### Neutral
- **Mực xanh đậm** (`#172B3A`): nội dung chính.
- **Chữ phụ** (`#405463`): nội dung thân bài.
- **Chữ hỗ trợ** (`#5C6F7D`): nhãn phụ và mô tả thứ cấp; vẫn phải đủ tương phản với nền thực tế.
- **Trắng** (`#FFFFFF`): nền chính và bề mặt biểu mẫu.
- **Xám xanh rất nhạt** (`#F4F8FB`): vùng nền phụ để phân chia các khu vực.
- **Xanh sương** (`#EAF4FB`): vùng nhấn nhẹ, không dùng làm nền cho chữ nhỏ nếu chưa xác minh tương phản.
- **Đường viền** (`#D7E2EA`): viền input và đường phân cách tinh tế.
- **Lỗi** (`#B42318`) và **thành công** (`#16794B`): phản hồi trạng thái, luôn đi kèm nhãn hoặc biểu tượng/ngữ nghĩa, không chỉ dựa vào màu.

**Quy tắc màu hành động.** Màu xanh hành động dành cho điều người dùng có thể thao tác hoặc trạng thái được chọn; không dùng như họa tiết trang trí lặp lại.

## 3. Typography

**Display Font:** Geist (fallback: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)  
**Body Font:** Geist (cùng fallback stack)  
**Label/Mono Font:** Không cần font mono riêng.

**Tính cách:** Chữ sans hiện đại, trung tính và dễ đọc. Dùng cùng một họ font để Landing, Login và giao diện Customer có cảm giác liền mạch; phân cấp bằng kích thước, độ đậm và khoảng cách thay vì đổi font tùy tiện.

### Hierarchy
- **Display** (600, `clamp(3rem, 6vw, 5.5rem)`, line-height 1.02): thông điệp chính của hero; chỉ dùng ở trang giới thiệu.
- **Headline** (600, `clamp(2rem, 4vw, 3.5rem)`, line-height 1.12): tiêu đề section và tiêu đề trang.
- **Title** (600, `1.25rem`, line-height 1.35): tiêu đề nhóm nội dung hoặc form.
- **Body** (400, `1rem`, line-height 1.6): nội dung đọc chính; giới hạn đoạn dài khoảng 65–75 ký tự mỗi dòng khi không phải dữ liệu giao diện.
- **Label** (500, `0.875rem`, line-height 1.4): nút, nhãn input và điều hướng; dùng sentence case, không viết hoa toàn bộ đoạn văn.

**Quy tắc cùng một giọng chữ.** Giữ Geist xuyên suốt hệ thống. Không dùng display style cho label, nút hoặc dữ liệu trong Customer System.

## 4. Elevation

Hệ thống ưu tiên bề mặt phẳng và phân lớp bằng màu nền cùng đường viền mảnh. Không dùng bóng đổ dày hoặc hiệu ứng kính làm ngôn ngữ mặc định. Có thể dùng bóng rất nhẹ cho menu nổi hoặc dialog khi cần thể hiện thứ tự lớp; chỉ dùng khi có thành phần thực sự nổi.

**Quy tắc phẳng trước.** Bề mặt thường không có bóng; ưu tiên `#FFFFFF`, `#F4F8FB` và đường viền `#D7E2EA` để tạo phân cấp.

## 5. Components

Thành phần cần gọn, rõ affordance và giữ cùng hình thức trên Landing, Login và Customer System.

### Buttons
- **Hình dáng:** góc bo nhẹ (`6px`), tránh dạng viên thuốc mặc định.
- **Primary:** nền xanh hành động `#2878C8`, chữ trắng, cao `48px`, padding `14px 22px`; hover chuyển `#1F64AA`.
- **Secondary:** nền trắng, chữ navy, cùng chiều cao và hình dáng với primary; dùng đường viền khi cần phân biệt với nền.
- **Focus:** hiển thị vòng focus nhìn thấy rõ, không chỉ đổi màu chữ/nền. Trạng thái disabled phải phân biệt và không gây nhầm là có thể thao tác.
- Chuyển trạng thái màu/viền ngắn khoảng `150–220ms`; tắt hoặc giảm chuyển động khi `prefers-reduced-motion: reduce`.

### Cards / Containers
- **Góc:** tối đa `16px`; dùng mức `6px`–`10px` cho form và container tác vụ.
- **Nền:** trắng hoặc xám xanh rất nhạt.
- **Bóng:** phẳng theo quy tắc Elevation; không lồng card trong card.
- **Khoảng đệm:** theo nhịp `16px`, `24px`, `32px`; tránh biến mọi section thành card.

### Inputs / Fields
- **Kiểu:** nền trắng, chữ `#172B3A`, viền `#D7E2EA`, góc `6px`, cao tối thiểu `48px`.
- **Focus:** viền xanh hành động và vòng focus rõ ràng; bảo đảm nhãn không chỉ là placeholder.
- **Error:** thông báo lỗi đặt sát trường liên quan, nêu cách khắc phục khi API có thông tin phù hợp; không chỉ đánh dấu bằng màu.
- **Login:** chỉ gồm email và password theo API hiện tại. Các hành vi khác chỉ xuất hiện khi requirements hoặc code hỗ trợ.

### Navigation
- **Desktop:** thanh điều hướng sáng, chiều cao tham chiếu `72px`, logo hiện có và ít liên kết ưu tiên.
- **Mobile:** thu gọn điều hướng theo không gian; giữ Sign In/Create Account dễ tìm, không để CTA che nội dung.
- Trạng thái hover/focus rõ ràng; giữ chung cách trình bày trên các route.

### Responsive behavior
- **Desktop:** dùng khoảng trắng rộng và hero có thể đặt chữ cạnh hoặc trên ảnh lớn.
- **Tablet:** thu hẹp khoảng cách, giữ thứ bậc tiêu đề và CTA không bị chen lấn.
- **Mobile:** chuyển bố cục nhiều cột thành một cột, giữ CTA đủ rộng/dễ chạm, không để tiêu đề hoặc nội dung tràn ngang.
- Dùng khoảng cách linh hoạt cho section lớn; điều khiển form và chữ giao diện giữ kích thước ổn định, dễ đọc.

## 6. Do's and Don'ts

### Do:
- **Do** dùng logo hiện có tại `frontend/public/logo.jpg` nguyên trạng.
- **Do** giữ chung màu xanh `#2878C8`, navy `#15344D` và font Geist giữa các trang.
- **Do** viết toàn bộ nội dung hiển thị trên website bằng tiếng Anh.
- **Do** dùng hình ảnh ngựa/vận chuyển có nguồn phù hợp và không hàm ý thông số đội xe hay năng lực chưa xác nhận.
- **Do** bảo đảm tương phản văn bản, trạng thái focus, nhãn form và hỗ trợ giảm chuyển động.
- **Do** kiểm tra bố cục ở desktop, tablet và mobile.

### Don't:
- **Don't** sao chép website Apple hoặc BMW; không dùng thương hiệu, nội dung hay hình ảnh của họ.
- **Don't** tách Landing Page thành một website thương hiệu độc lập với Horse Transport System.
- **Don't** thêm testimonial, thống kê, thông tin công ty, thông tin liên hệ, thông số đội xe hoặc tuyên bố năng lực chưa được xác nhận.
- **Don't** giới thiệu GPS/live map, live video, giám sát nhiệt độ, bảo hiểm hoặc ước tính giá tức thì như tính năng hệ thống.
- **Don't** dùng quá nhiều card, gradient, icon hoặc hiệu ứng trang trí.
- **Don't** dùng màu một mình để biểu đạt lỗi/thành công; dùng chữ và trạng thái có ngữ nghĩa.
