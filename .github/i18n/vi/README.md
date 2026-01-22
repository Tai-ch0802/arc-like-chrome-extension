# Thanh bên Chrome phong cách Arc

[English](/.github/i18n/en/README.md) | [繁體中文](/.github/i18n/zh_TW/README.md) | [简体中文](/.github/i18n/zh_CN/README.md) | [日本語](/.github/i18n/ja/README.md) | [한국어](/.github/i18n/ko/README.md) | [Deutsch](/.github/i18n/de/README.md) | [Español](/.github/i18n/es/README.md) | [Français](/.github/i18n/fr/README.md) | [हिन्दी](/.github/i18n/hi/README.md) | [Bahasa Indonesia](/.github/i18n/id/README.md) | [Português (Brasil)](/.github/i18n/pt_BR/README.md) | [Русский](/.github/i18n/ru/README.md) | [ไทย](/.github/i18n/th/README.md) | [Tiếng Việt](/.github/i18n/vi/README.md)

---

[![Version](https://img.shields.io/chrome-web-store/v/beoonblekmppafnjppedgpgfngghebji?style=flat-square&logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Rating](https://img.shields.io/chrome-web-store/rating/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Users](https://img.shields.io/chrome-web-store/users/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Build Status](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/Tai-ch0802/arc-like-chrome-extension?style=flat-square)](../../LICENSE)

Đây là một dự án tiện ích mở rộng Chrome nhằm mang lại trải nghiệm thanh bên dọc giống trình duyệt Arc cho Google Chrome, cung cấp một bảng điều khiển thống nhất và mạnh mẽ để quản lý các tab và dấu trang (bookmarks).

## 🚀 Cập nhật phiên bản mới v1.11.0!
[![Video mô tả](http://img.youtube.com/vi/Ld4lyaZatWo/0.jpg)](https://www.youtube.com/watch?v=Ld4lyaZatWo)

### ⚡️ Tính năng
- **Tab dọc**: Xem tiêu đề trang đầy đủ, không còn bị nén thành các biểu tượng nhỏ xíu.
- **Nhóm tab**: Tích hợp hoàn hảo với các Nhóm tab của Chrome, đồng bộ hóa màu sắc và tên.
- **Tích hợp dấu trang**: Bảng điều khiển thống nhất để quản lý cả tab và dấu trang.
- **Tab liên kết**: Tự động tạo một "Liên kết" khi mở một dấu trang, giúp tránh mở lặp lại.
- **Tìm kiếm đa cửa sổ**: Tìm kiếm tab và dấu trang trên tất cả các cửa sổ Chrome đang mở.
- **Kết xuất động**: Kết xuất (rendering) hiệu quả cho các thư viện dấu trang lớn.

## 🤝 Tham gia đóng góp

Chúng tôi luôn chào đón các đóng góp từ cộng đồng! Dù bạn đang sửa lỗi, cải thiện tài liệu hay đề xuất một tính năng mới, sự giúp đỡ của bạn đều rất đáng quý.

Chúng tôi sử dụng quy trình làm việc **Phát triển dựa trên đặc tả (SDD)** và **thân thiện với AI**. Hãy xem hướng dẫn đóng góp của chúng tôi để bắt đầu:

👉 **[Đọc Hướng dẫn đóng góp của chúng tôi](./CONTRIBUTING.md)**

Để biết ví dụ thực tế về quy trình phát triển, vui lòng tham khảo [Issue #30](https://github.com/Tai-ch0802/arc-like-chrome-extension/issues/30).

---

## 🔥 Các tính năng chính

### 🔗 Sáng tạo độc quyền: Tab liên kết (Linked Tabs)
Đây là tính năng mạnh mẽ nhất của chúng tôi! Khi bạn mở một dấu trang từ thanh bên, chúng tôi sẽ tự động tạo một **"Liên kết"**.
- **Tránh lộn xộn tab**: Nhấp vào biểu tượng liên kết bên cạnh dấu trang để xem tất cả các tab được mở từ dấu trang đó, giúp bạn tránh mở trùng lặp và tiết kiệm tài nguyên hệ thống.
- **Đồng bộ hai chiều**: Khi một tab bị đóng, trạng thái dấu trang sẽ tự động cập nhật; khi một dấu trang bị xóa, tab liên kết sẽ được xử lý một cách thông minh.
- **Phản hồi trực quan**: Một biểu tượng liên kết tinh tế xuất hiện bên cạnh dấu trang, giúp bạn biết ngay dấu trang nào hiện đang hoạt động.

### ⚡️ Kết xuất thông minh
Có hàng ngàn dấu trang? Không vấn đề gì!
- **Kết xuất động**: Chuyển từ Cuộn ảo (Virtual Scrolling) sang cơ chế Kết xuất động hiệu quả, đảm bảo hiệu suất mượt mà với khả năng tương thích tốt hơn.
- **Trải nghiệm mượt mà**: Điều hướng qua các thư viện dấu trang lớn một cách dễ dàng mà không bị giật lag.

### 🪟 Quản lý đa cửa sổ
- **Tổng quan cửa sổ**: Xem các tab từ tất cả các cửa sổ Chrome đang mở trực tiếp trong thanh bên, không chỉ cửa sổ hiện tại.
- **Tìm kiếm toàn cục**: Kết quả tìm kiếm bao gồm các tab từ tất cả các cửa sổ, cho phép bạn điều hướng tức thì trong toàn bộ phiên làm việc.

### 🔍 Tìm kiếm chuyên nghiệp
Không chỉ tìm kiếm — mà là tìm thấy ngay lập tức.
- **Lọc nhiều từ khóa**: Hỗ trợ các từ khóa cách nhau bằng dấu cách (ví dụ: "google docs work") để nhắm mục tiêu chính xác.
- **Tìm kiếm theo tên miền**: Nhập một tên miền (như `github.com`) để lọc ngay các tab và dấu trang từ các nguồn cụ thể.
- **Làm nổi bật thông minh**: Làm nổi bật theo thời gian thực các từ khóa trùng khớp giúp tiêu điểm thị giác của bạn luôn rõ ràng.

### 🗂️ Không gian làm việc thống nhất
- **Tab dọc**: Xem tiêu đề trang đầy đủ mà không bị nén.
- **Hỗ trợ Nhóm nguyên bản**: Tích hợp hoàn hảo với các Nhóm tab của Chrome.
- **Đặt tên cửa sổ tùy chỉnh**: Gán tên tùy chỉnh cho các cửa sổ của bạn (ví dụ: "Công việc", "Cá nhân") để có ngữ cảnh rõ ràng hơn.
- **Kéo và thả**: Quản lý trực quan — di chuyển các mục dễ dàng giữa các tab, nhóm và thư mục dấu trang.
- **Kéo để lưu**: Kéo một tab vào vùng dấu trang để lưu ngay lập tức; kéo một dấu trang vào vùng tab để mở.

### 🎨 Thiết kế cao cấp
- **Chế độ Tập trung**: Một chủ đề tối bóng bẩy với độ tương phản được điều chỉnh cẩn thận để giảm mỏi mắt.
- **Tự động mở rộng**: Di chuột qua các thư mục trong khi kéo các mục để tự động mở rộng đường dẫn.
- **Di chuột thông minh**: Các nút hành động chỉ xuất hiện khi cần thiết, giữ cho giao diện sạch sẽ và không gây xao nhãng.

## ⌨️ Điều hướng bằng bàn phím đầy đủ
- **Trải nghiệm nguyên bản**: Sử dụng các phím `Mũi tên Lên`/`Mũi tên Xuống` để điều hướng mượt mà giữa các tab và dấu trang.
- **Tương tác vi mô**: Sử dụng `Mũi tên Trái`/`Mũi tên Phải` để điều hướng và kích hoạt các nút nội bộ (như Đóng, Thêm vào Nhóm).
- **Tích hợp tìm kiếm**: Nhấn `Lên` tại đầu danh sách để lấy tiêu điểm cho thanh tìm kiếm; nhấn `Xuống` trong thanh tìm kiếm để nhảy đến kết quả.
- **Mẹo lấy tiêu điểm**: Một khi thanh bên đã mở, chỉ cần nhấn bất kỳ phím mũi tên nào để tự động lấy tiêu điểm và bắt đầu điều hướng.

### ⌨️ Phím tắt năng suất
- **Cmd/Ctrl + I**: Bật/Tắt thanh bên
- **Opt/Alt + T**: Tạo tab mới bên cạnh tab hiện tại

---

## 🆚 Tại sao nên chọn tiện ích này?

| Tính năng | Tiện ích này | Chrome nguyên bản | Thanh bên truyền thống |
| :--- | :---: | :---: | :---: |
| **Tab dọc** | ✅ Tiêu đề đầy đủ | ❌ Bị nén | ✅ |
| **Nhóm tab** | ✅ Đồng bộ nguyên bản | ✅ | ⚠️ Một phần |
| **Tích hợp dấu trang** | ✅ Bảng thống nhất | ❌ Trình quản lý riêng | ❌ Riêng biệt |
| **Tab liên kết** | ✅ Trạng thái đồng bộ | ❌ | ❌ |
| **Tìm kiếm đa cửa sổ** | ✅ | ❌ | ⚠️ Khác nhau |
| **Hiệu suất** | ⚡️ Kết xuất động | N/A | 🐢 Cuộn ảo |

---

## 🚀 Cài đặt & Phát triển

### Lựa chọn 1: Cài đặt từ Cửa hàng Chrome trực tuyến (Khuyến nghị)

Bạn có thể cài đặt tiện ích trực tiếp từ cửa hàng chính thức để nhận các bản cập nhật tự động:

[**Nhấp vào đây để cài đặt từ Cửa hàng Chrome trực tuyến**](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji?utm_source=item-share-cb)

### Lựa chọn 2: Cài đặt thủ công từ nguồn (Dành cho nhà phát triển)

**1. Điều kiện tiên quyết**

Trước khi bắt đầu, hãy đảm bảo bạn đã cài đặt [Node.js](https://nodejs.org/) (bao gồm npm) trên hệ thống của mình.

**2. Các bước thiết lập**

1.  Sao chép hoặc tải dự án này về máy tính của bạn.
    ```bash
    git clone https://github.com/Tai-ch0802/arc-like-chrome-extension.git
    ```
2.  Di chuyển vào thư mục dự án và cài đặt các phụ thuộc phát triển cần thiết:
    ```bash
    cd arc-like-chrome-extension
    npm install
    ```
3.  Mở trình duyệt Chrome và truy cập `chrome://extensions`.
4.  Bật "Chế độ dành cho nhà phát triển" ở góc trên cùng bên phải.
5.  Nhấp vào "Tải tiện ích đã giải nén" và chọn thư mục gốc của dự án.

---

## 🛠️ Các lệnh Build

Dự án này sử dụng `Makefile` để tự động hóa quy trình xây dựng.

*   **Chế độ phát triển**: `make` hoặc `make package`

    Lệnh này tạo ra một bản dựng phát triển không nén (unminified). Tất cả mã nguồn được giữ nguyên, giúp bạn dễ dàng gỡ lỗi trong các công cụ dành cho nhà phát triển của Chrome. Tệp được đóng gói sẽ là `arc-sidebar-v<version>-dev.zip`.

*   **Chế độ phát hành (Production)**: `make release`

    Lệnh này chạy quy trình xây dựng bản phát hành, bao gồm các bước sau:
    1.  Gộp và nén tất cả các mô-đun JavaScript vào một tệp duy nhất bằng `esbuild`.
    2.  Nén tệp CSS.
    3.  Đóng gói đầu ra vào tệp `.zip` phù hợp để tải lên Cửa hàng Chrome trực tuyến.

---

## 🧪 Kiểm thử

Để đảm bảo chất lượng và tính ổn định của các tính năng, chúng tôi áp dụng phương pháp kiểm thử theo trường hợp sử dụng (Use Case Testing) để xác thực mọi thay đổi.

### Các bài kiểm thử trường hợp sử dụng

*   **Mục đích**: Mỗi bài kiểm thử trường hợp sử dụng xác định rõ hành vi mong đợi và quy trình vận hành của một tính năng cụ thể. Chúng được trình bày dưới dạng văn bản mô tả, nêu chi tiết các bước kiểm thử, điều kiện tiên quyết, kết quả mong đợi và các phương pháp xác minh.
*   **Vị trí**: Tất cả các tệp kiểm thử trường hợp sử dụng được lưu trữ trong thư mục `usecase_tests/` tại thư mục gốc của dự án.
*   **Thực hiện & Xác minh**: Hiện tại các bài kiểm thử này chủ yếu được thực hiện thủ công. Các nhà phát triển cần mô phỏng các thao tác của người dùng trong tiện ích Chrome đang chạy theo các bước trong tệp kiểm thử và quan sát xem kết quả có đáp ứng mong đợi hay không.

### Kiểm thử tự động

Đối với việc kiểm thử tự động trong tương lai, chúng tôi đã chọn **Puppeteer** làm khung (framework) kiểm thử End-to-End (E2E). Điều này cho phép chúng tôi viết các tập lệnh để mô phỏng các hành động khác nhau của người dùng trong trình duyệt và xác minh chức năng.

---

## 🔒 Quyền riêng tư & FAQ

Chúng tôi coi trọng quyền riêng tư của bạn. Tiện ích này hoạt động hoàn toàn cục bộ và không thu thập hoặc truyền dữ liệu cá nhân của bạn.

Để biết thêm chi tiết, vui lòng xem [Chính sách bảo mật](../../PRIVACY_POLICY.md) của chúng tôi.

---

## 👥 Người đóng góp

Lời cảm ơn đặc biệt đến tất cả những người đóng góp đã giúp dự án này trở nên tốt hơn:

<a href="https://github.com/Tai-ch0802/arc-like-chrome-extension/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Tai-ch0802/arc-like-chrome-extension" />
</a>

## 📜 Giấy phép

Dự án này được cấp phép theo Giấy phép MIT - xem tệp [LICENSE](../../LICENSE) để biết chi tiết.
