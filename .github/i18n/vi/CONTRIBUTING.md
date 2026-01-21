# Hướng dẫn đóng góp

🎉 Trước hết, cảm ơn bạn đã dành thời gian đóng góp cho dự án!

Chúng tôi nỗ lực xây dựng một cộng đồng nguồn mở **ít rào cản** và **thân thiện với AI**. Chúng tôi khuyến khích mạnh mẽ việc sử dụng các công cụ AI (đặc biệt là **Antigravity IDE**) để hỗ trợ quá trình phát triển. Ngay cả khi bạn là người mới làm quen với lập trình hay chưa quen thuộc với lĩnh vực này, miễn là bạn có ý tưởng, chúng tôi luôn chào mừng bạn đóng góp thông qua quy trình chuẩn hóa của chúng tôi.

Tài liệu này sẽ hướng dẫn bạn cách biến một "mong muốn mơ hồ" thành một "tính năng hữu dụng".

## 🚀 Triết lý cốt lõi

1.  **Phát triển dựa trên AI (AI-Native Development)**: Chúng tôi đón nhận AI. Đừng ngần ngại để AI giúp bạn viết code, viết tài liệu hoặc giải thích kiến trúc.
2.  **Phát triển theo đặc tả (Spec-Driven Development - SDD)**: Suy nghĩ kỹ trước khi thực hiện. Đặc tả trước, mã nguồn sau. (`No Spec, No Code`)
3.  **Hạn chế ma sát (Low Friction)**: Sử dụng các công cụ tự động và quy trình vận hành tiêu chuẩn (SOP) rõ ràng để giảm độ khó khi tham gia đóng góp.

## 🛠 Công cụ

*   **IDE**: Khuyến khích mạnh mẽ sử dụng **Antigravity IDE** (trình chỉnh sửa mã nguồn được tăng cường bởi AI).
*   **Kiểm soát phiên bản**: Git & GitHub CLI (`gh`).
*   **Runtime**: Node.js & npm.

## 🛤 SOP cho nhà phát triển: Từ ý tưởng đến hiện thực

Chúng tôi áp dụng quy trình chuẩn hóa **Phát triển theo đặc tả (SDD)** để hỗ trợ bạn hoàn thành quá trình phát triển theo từng bước.

### Giai đoạn 1: Ý tưởng & Vấn đề (Idea & Issue)

Mọi thứ đều bắt đầu từ một ý tưởng.

1.  **Kiểm tra các Issue hiện có**: Xem liệu đã có ai đề xuất ý tưởng tương tự chưa.
2.  **Tạo Issue**:
    *   Nếu là tính năng mới, hãy sử dụng mẫu **Feature Request**.
    *   Nếu là sửa lỗi, hãy sử dụng mẫu **Bug Report**.
    *   *Mẹo: Ngay cả khi ý tưởng còn mơ hồ, bạn vẫn có thể mở một Issue để thảo luận.*

### Giai đoạn 2: Phân tích & Đặc tả (Analysis & Spec)

Sau khi Issue được xác nhận, chúng ta sẽ bước vào quy trình SDD. Đây là thời điểm tốt nhất để học hỏi kiến thức chuyên môn (Domain Knowledge).

1.  **Khởi động Workflow SDD**:
    Tại thư mục gốc của dự án, bạn có thể yêu cầu AI Agent:
    > "Tôi muốn bắt đầu phát triển Issue #123, vui lòng thực hiện lệnh /sdd-process giúp tôi"
    *   AI sẽ tạo thư mục chuẩn: `/docs/specs/{type}/ISSUE-123_{desc}/`.

2.  **Soạn thảo PRD (Tài liệu yêu cầu sản phẩm)**:
    *   AI sẽ hỗ trợ bạn tạo tệp `/docs/specs/.../PRD_spec.md`.
    *   Bạn cần định nghĩa: **Cần làm gì (User Stories)** và **Tiêu chí nghiệm thu (Acceptance Criteria)**.
    *   *Mẹo: Tận dụng AI để giúp bạn hoàn thiện User Stories và các trường hợp biên (edge cases).*

3.  **Soạn thảo SA (Phân tích hệ thống)**:
    *   Sau khi PRD được phê duyệt, AI sẽ hỗ trợ tạo tệp `/docs/specs/.../SA_spec.md`.
    *   Bạn cần định nghĩa: **Kiến trúc kỹ thuật**, **API**, **Luồng dữ liệu**.
    *   **Traceability**: Đảm bảo mọi quyết định thiết kế đều tương ứng với các yêu cầu trong PRD.

### Giai đoạn 3: Thực hiện (Implementation)

Sau khi các đặc tả đã hoàn thiện, đây là lúc bắt đầu viết mã nguồn một cách hào hứng.

1.  **Kiểm tra trước khi viết mã (Pre-Code Check)**:
    *   Xác nhận trạng thái của cả PRD và SA đều là **Approved**.

2.  **Để AI viết mã nguồn**:
    *   Cung cấp `PRD_spec.md` và `SA_spec.md` cho Antigravity/AI.
    *   Ví dụ câu lệnh: *"Vui lòng thực hiện tính năng hiển thị các cửa sổ khác theo Task 1 trong SA_spec.md."*

3.  **Tài liệu sống (Living Documentation)**:
    *   ⚠️ **Quan trọng**: Nếu trong quá trình thực hiện, bạn thấy cần sửa đổi thiết kế, **hãy cập nhật SA/PRD ngay lập tức**.
    *   Luôn giữ cho Đặc tả và Mã nguồn đồng bộ với nhau.

### Giai đoạn 4: Xác minh & PR (Verification & PR)

1.  **Tự kiểm tra**:
    *   Chạy `npm test` để đảm bảo vượt qua các bài kiểm tra.
    *   Kiểm tra từng tiêu chí trong phần **Tiêu chí nghiệm thu (Acceptance Criteria)** trong tệp `PRD_spec.md`.

2.  **Tạo Pull Request**:
    *   Sử dụng `gh` CLI để tạo PR (khuyến khích) hoặc thông qua giao diện web.
    *   Nếu đang sử dụng Antigravity, bạn có thể sử dụng workflow `/create-pr` trực tiếp.
    *   Chạy tập lệnh xác minh:
        ```bash
        ./.agent/skills/pull-request/scripts/check-pr.sh
        ```
    *   Đảm bảo mô tả PR đầy đủ và bao gồm ngữ cảnh song ngữ (AI có thể giúp bạn dịch thuật).
    *   **Báo cáo**: Ghi nhận kết quả xác minh (Đạt/Không đạt) trong phần mô tả PR.

## 📝 Hướng dẫn phong cách

*   **Commit Messages**: Tuân theo quy tắc Conventional Commits (`feat`, `fix`, `docs`, `refactor`...).
    *   Bạn có thể sử dụng skill `commit-message-helper` trong dự án này.
*   **Ngôn ngữ**: Tài liệu dự án và giao tiếp có thể sử dụng tiếng mẹ đẻ của bạn, nhưng chú thích mã nguồn và tên biến nên sử dụng tiếng Anh.
*   **Phong cách viết mã (Code Style)**: Duy trì sự nhất quán, tham khảo phong cách viết mã hiện có của dự án.

## 🤝 Tìm kiếm sự trợ giúp

*   Nếu bạn gặp khó khăn trong quá trình thực hiện, hãy để lại bình luận trong Issue.
*   Đừng ngần ngại hỏi AI: "Đoạn code này có nghĩa là gì?" hoặc "Tôi nên kiểm tra tính năng này như thế nào?".

Chúng tôi rất mong chờ sự đóng góp của bạn! Hãy cùng AI xây dựng những phần mềm tuyệt vời hơn.
