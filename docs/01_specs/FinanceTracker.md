# FinanceTracker - Tài liệu Đặc tả Tính năng Hiện tại (PRD)

**Nền tảng:** Web App / Progressive Web App (PWA) thiết kế **chỉ dành riêng cho thiết bị Di động (Mobile-only UI)**.  
**Frontend:** React / JavaScript (JS)  
**Hosting:** Vercel (Gói FREE)  
**Database & Dịch vụ Backend:** Supabase (Gói FREE)  
**Ngôn ngữ ứng dụng:** Thuần Tiếng Việt.
---

## TỔNG QUAN ỨNG DỤNG
**FinanceTracker** là một ứng dụng quản lý tài chính cá nhân toàn diện, được thiết kế tối ưu cho trải nghiệm di động (Mobile-only). Ứng dụng không chỉ đơn thuần là một sổ ghi chép thu chi, mà còn là một công cụ quản lý tài sản ròng (Net Worth), theo dõi nợ, lập kế hoạch tiết kiệm và dự báo tài chính dài hạn. Với giao diện hiện đại, quy tắc nhập liệu thông minh (x1000) và khả năng tích hợp linh hoạt giữa các module, FinanceTracker giúp người dùng nắm bắt hoàn toàn bức tranh tài chính của mình và đưa ra các quyết định đầu tư, vay vốn hoặc tiết kiệm một cách sáng suốt.

---

## 1. QUY TẮC TOÀN CỤC & HỆ THỐNG CỐT LÕI

### 1.1. Tiêu chuẩn Giao diện Di động (Mobile-UI Standards)
Vì ứng dụng chỉ phục vụ trên màn hình điện thoại, toàn bộ giao diện phải mô phỏng trải nghiệm của một Native App (Ứng dụng gốc):
- **Điều hướng (Navigation):** Sử dụng thanh điều hướng dưới cùng (Bottom Tab Bar) cho 4-5 màn hình chính.
- **Tương tác:** Khuyến khích sử dụng Cử chỉ vuốt (Swipe to delete/edit) trên các danh sách.
- **Nhập liệu (Input):** Các form điền thông tin (Thêm giao dịch, Thêm mục tiêu...) phải dùng Bottom Sheet trượt từ dưới lên, chiếm tối đa 80% màn hình để dễ dàng thao tác bằng một tay.
- **Che lấp cạnh (Safe Area):** Padding phù hợp để tránh bị lẹm vào "Tai thỏ" (Notch) hoặc thanh Home bar trên iOS/Android.

### 1.2. Logic Nhập liệu Tiền tệ (x1000 Multiplier)
Tối ưu hóa luồng UI/UX cho người tiêu dùng Việt Nam bằng quy tắc nhập liệu rút gọn **x1000** đối với tất cả các biểu mẫu:
- Người dùng chỉ cần nhập hàng nghìn (ví dụ nhập `1.000` biểu thị cho 1 triệu đồng).
- Hệ thống tự động thêm dấu chấm phân cách hàng nghìn ngay trên trường nhập liệu.
- Khi lưu vào Database (Supabase), hệ thống tự động nhân 1000 (`* 1000`) để luân chuyển tính toán chính xác.
- **Phạm vi áp dụng:** Thêm Giao dịch, Tài khoản, Cập nhật giá Tài sản, Mục tiêu, Ngân sách và Tính toán khoản vay.

### 1.3. Xác thực Người dùng (Authentication)
Xây dựng dựa trên hệ thống Supabase Auth để bảo mật dữ liệu:
- **Đăng ký / Đăng nhập:** Hỗ trợ đăng nhập qua Email/Password và Đăng nhập nhanh qua Google (Google OAuth).
- **Đăng xuất:** Xoá phiên làm việc an toàn, xoá bộ đệm state tĩnh trên trình duyệt.
- **Bảo mật truy cập:** Người dùng chưa đăng nhập sẽ bị tự động điều hướng (Redirect) về Auth Creen. Mọi dữ liệu trích xuất từ Database đều được bảo vệ bằng Row Level Security (RLS) gắn cứng với `user_id`.

---

## 2. CHI TIẾT TỪNG MODULE CHỨC NĂNG

### Module 1: Trang chủ (Dashboard)
Hiển thị ngay khi mở app, thân thiện, dễ nhìn bằng một tay.
- **Tài sản Ròng (Net Worth):** Tự động tính toán theo công thức: `[Tổng số dư các Tài khoản/Ví] + [Tổng giá trị Tài sản (Assets)] + [Khoản phải thu (Receivables)] - [Khoản nợ/Thẻ tín dụng (Liabilities)]`.
- **Thống kê nhanh:** Hiển thị dạng khối (Cards) cho tổng tài sản và tổng Tiêu sản/Nợ.
- **Lối tắt thao tác:** Một nút cộng khổng lồ nổi lên (Floating Action Button - FAB) hoặc nằm ở trung tâm Bottom Tab Bar để "Thêm Giao dịch".
- **Danh sách gần đây:** Liệt kê 5 tài khoản và 5 giao dịch thực hiện gần nhất ở dưới cùng.

### Module 2: Quản lý Ví & Tài khoản (Accounts)
- **Phân loại Tài khoản:**
  - Tiền mặt, Ngân hàng, Ví điện tử...
- **Loại con (Sub-types):** Mọi tài khoản đều thuộc một trong hai loại con:
  - **Tài khoản thanh toán (Payment):** Phục vụ chi tiêu và luân chuyển dòng tiền hằng ngày.
  - **Tài khoản tiết kiệm (Savings):** Phục vụ mục đích tích lũy và hưởng lãi suất.
- **Tuỳ biến:** Chọn biểu tượng (Icons) và màu sắc (Color Hex).

### Module 3: Quản lý Sổ Nợ / Thu Chi Hộ (Debt Management)
Được ghép chung vào phần Quản lý Ví để không làm rườm rà thanh Tab Bar.
- **Khoản Phải Thu:** Tiền người khác nợ mình.
- **Khoản Cần Trả:** Tiền mình đang nợ.
- Dễ dàng nhấn vào nợ để tạo Giao dịch thu/trả nợ (Transfer).

### Module 4: Sổ Giao dịch (Transactions & History)
Màn hình lõi thao tác nhiều nhất của người dùng.
- **Phân loại Giao dịch:** Thu (Income), Chi (Expense), Chuyển khoản nội bộ (Transfer).
- **Hệ thống Danh mục (Categories):** Lựa chọn danh mục theo dạng phân cấp. 
  - **Khởi tạo mặc định:** Ứng dụng tự động tạo sẵn các danh mục cơ bản:
    - *Thu nhập:* Lương, Cổ tức, Thu nhập khác.
    - *Chi phí:* Ăn uống, Đi chợ, Di chuyển, Điện thoại, Tiền nhà, Điện nước, Y tế, Giải trí, Chi tiêu khác.
  - **Tuỳ chỉnh:** Người dùng có toàn quyền thêm mới, chỉnh sửa tên/biểu tượng hoặc xoá các danh mục này.
- **Ghi chú Thông minh:** Nếu là khoản đóng góp định mức cho "Mục tiêu tiết kiệm", hệ thống sẽ tự sinh note thông báo tiếng Việt "Góp vốn cho mục tiêu: [Tên]".
- **Lịch sử & Hoàn tác:** Danh sách hiển thị cuộn vô hạn (Infinite Scroll). Khi người dùng vuốt xoá (Swipe to delete) một giao dịch, hệ thống sẽ tự động gọi backend sửa lại số dư ví (Rollback balance) một cách chính xác.

### Module 5: Mục tiêu Tiết kiệm (Savings Goals)
- **Theo dõi Tiến độ:** Biểu thị bằng thanh tiến trình ngang (Progress bar).
- **Chức năng Góp vốn:** Có nút bấm nhanh hình dấu (+) bên cạnh mỗi thanh. Mở Bottom Sheet -> Nhập số tiền -> Ghi nhận "Giao dịch chuyển tiền nội bộ" -> Củng cố thông số hoàn thành mục tiêu.

### Module 6: Danh mục Đầu tư & Assets (Wealth Tracker)
- **Phân loại Tài sản:** Vàng/Kim loại quý, Chứng khoán, Tiền điện tử, Bất động sản và **Tiền gửi tiết kiệm (Tự động)**.
- **Cơ chế Tiền gửi tiết kiệm tự động:** 
  - Hệ thống tự động tổng hợp số dư từ tất cả các "Tài khoản tiết kiệm" ở Module 2 để hiển thị vào mục này.
  - Người dùng không thể chỉnh sửa thủ công giá trị này trong Module Tài sản mà phải thực hiện nạp/rút tiền thông qua các giao dịch tài khoản.
- **Định vị đơn vị tính:** Hỗ trợ nhập độc lập Số lượng và Đơn vị (ví dụ: Chỉ, Cổ phần, BTC).
- **Cập nhật Tỷ giá định kỳ:** Mở Bottom Sheet cài đặt lại Tỷ giá hiện tại do người dùng tự ước lượng.
- **History Tracker:** Mỗi khi thay đổi tỷ giá, tự kích hoạt ngầm tạo dòng dữ liệu mới trong bảng Lịch sử Biến động giá (`asset_price_history`).

### Module 7: Ngân sách & Cảnh báo (Budgeting)
- **Thiết lập chu kỳ:** Tuỳ chọn "Ngày bắt đầu chu kỳ" (ví dụ: lấy lương ngày 5).
- **Lập Ngân sách:** Đặt hạn mức chi tiêu cho từng danh mục cố định.
- **Cảnh báo:** Quẹt màu đỏ trên thanh Progress của danh mục nếu chi tiêu định mức bị vượt qua.

### Module 8: Công cụ tài chính (Financial Tools)
Dạng các thẻ tiện ích con (Card-based UI).
- **Tính toán khoản vay (Loan Calculator):**
  - **Thông số đầu vào nâng cao:**
    - **Gói vay:** Số tiền vay, Thời hạn vay (tháng).
    - **Lãi suất:** 
      - Lãi suất ưu đãi (%) và Thời gian ưu đãi (tháng).
      - Lãi suất cơ sở (Lãi suất tiết kiệm) và Biên độ (%) để tính Lãi suất thả nổi sau ưu đãi.
    - **Kế hoạch tất toán sớm:**
      - **Số tiền chi trả hàng tháng:** Người dùng có thể nhập số tiền cao hơn số phải trả tối thiểu. Phần dư sẽ được hệ thống cộng dồn hàng tháng.
      - **Ngưỡng tất toán định kỳ (Principal Offset):** Khi dư nợ tích lũy đạt ngưỡng (ví dụ: 20 triệu), hệ thống thực hiện trừ trực tiếp vào tổng nợ gốc ngay lập tức (giảm tiền lãi từ tháng tiếp theo). Đồng thời, số tiền này được dùng để **bù trừ kỳ hạn**: Người dùng sẽ không phải trả phần nợ gốc bắt buộc trong $N$ tháng tới ($N = \text{Tiền tất toán} / \text{Gốc hàng tháng}$). Trong thời gian này, người dùng chỉ cần thanh toán phần Tiền lãi (tính trên dư nợ đã giảm).
      - **Phí tất toán sớm (Prepayment Penalty):** Cho phép cấu hình biểu phí phạt theo thời gian vay (Ví dụ: Năm 1-3 phí 3% trên số tiền trả trước; Năm 4 phí 1%; Năm 5 trở đi 0%).
  - **Kết quả mô phỏng (Output):**
    - **Dòng tiền hàng tháng:** Số tiền phải trả (Gốc + Lãi) trong thời gian ưu đãi và thời gian thả nổi.
    - **Hiệu quả trả nợ sớm:** 
      - **Thời gian trả nợ thực tế:** Tổng thời gian thực tế để hết nợ khi áp dụng tích lũy và tất toán sớm.
      - **Tổng phí tất toán sớm:** Tổng số tiền phí phạt phải trả cho ngân hàng dựa trên biểu phí đã cấu hình.
      - **Tiền lãi tiết kiệm thực tế:** Tổng số tiền lãi tiết kiệm được sau khi đã trừ đi các khoản phí tất toán sớm.
    - **Bảng Cân đối (Amortization Schedule):** Danh sách chi tiết từng tháng, thể hiện rõ các thời điểm nợ gốc được trừ một khoản lớn khi đạt ngưỡng tích lũy.

### Module 9: Cài đặt Hệ thống & Hồ sơ (Settings & User Profile)
- **Hồ sơ Người dùng:** Avatar, tên người dùng, thay đổi mật khẩu và Nút **Đăng xuất**.
- **Tiền tệ:** Chuyển đổi Đồng tiền cơ sở (VND/USD).
- **Xuất Dữ liệu (Export CSV):** Nút tải File dữ liệu `.csv` về thiết bị để xem Offline.
- **Quản lý Dữ liệu:** Xoá trắng dữ liệu cá nhân hiện tại.

### Module 11: Dự báo Tài chính (Financial Projection)
Công cụ mô phỏng sự biến động tài sản dựa trên kế hoạch ngân sách và các lịch trình tài chính hiện có.
- **Cơ chế Đồng bộ Dữ liệu (Smart Integration):** 
  - **Tái sử dụng Ngân sách (Module 7):** Thay vì yêu cầu người dùng nhập lại, hệ thống tự động lấy định mức Thu nhập và Chi tiêu từ Module Ngân sách làm cơ sở tích lũy hàng tháng.
  - **Tích hợp nợ vay (Module 8):** Tự động trừ đi dư nợ gốc và lãi vay phát sinh theo thời gian.
  - **Tích hợp tiết kiệm (Module 10):** Tự động cộng dồn tiền lãi khi đến ngày đáo hạn của các khoản gửi.
- **Thuật toán dự toán:**
  - `Tài sản dự kiến = [Tài sản ròng hiện tại] + ([Ngân sách Thu nhập] - [Ngân sách Chi tiêu]) * [Số tháng dự báo] - [Trả nợ phát sinh] + [Lãi tiết kiệm phát sinh]`.
- **Chức năng đặc thù:**
  - **Slider thời gian:** Người dùng có thể kéo để xem giá trị tài sản thay đổi theo từng tháng (từ 1 đến 120 tháng).
  - **Biểu đồ tăng trưởng (Growth Chart):** Hiển thị đường cong tài sản biến thiên theo thời gian.
  - **Phân tích mục tiêu:** Tính toán ngày chính xác người dùng sẽ đạt được các "Mục tiêu tiết kiệm" (Module 5) dựa trên tốc độ tích lũy thực tế này.

### Module 10: Quản lý Tiền gửi tiết kiệm (Savings Deposits)
Quản lý chuyên sâu các khoản tiền gửi có kỳ hạn tại ngân hàng để tối ưu hóa lợi nhuận.
- **Điều kiện:** Chỉ kích hoạt khi Tài khoản (Account) là loại `Ngân hàng` và `Loại con = Savings`.
- **Thông tin quản lý:** 
  - Ngày bắt đầu gửi, Kỳ hạn (tháng), Lãi suất (%/năm).
  - **Phân loại mục đích:** Người dùng chọn một trong hai loại:
    - **Tiết kiệm tích lũy:** Tích lũy tài sản dài hạn.
    - **Tiết kiệm thanh toán nợ:** Khoản tiền dự phòng để thanh toán các khoản vay (Module 8).
- **Hệ thống Thống kê (Statistics):**
  - **Theo từng tài khoản:** Tổng tiền gốc đang gửi, Tổng tiền lãi dự kiến nhận được.
  - **Tổng hợp toàn hệ thống:** Tổng tất cả tiền gốc tiết kiệm, Tổng tất cả tiền lãi sẽ nhận.
- **Tính toán tự động:**
  - **Tiền lãi dự kiến:** `Số tiền gốc * (Lãi suất/100) * (Kỳ hạn / 12)`.
  - **Ngày đáo hạn:** `Ngày bắt đầu + Kỳ hạn`.
- **Tích hợp Ngân sách (Budget):**
  - Số tiền lãi dự kiến tự động được cộng vào dự toán của Danh mục **"Lãi tiền gửi"** (nhóm Thu nhập) trong tháng của Ngày đáo hạn.
- **Xử lý Tất toán (Settlement):**
  - **Tất toán đúng hạn:** Trạng thái chuyển thành "Đã tất toán", tạo giao dịch Thu nhập tự động.
  - **Tất toán trước hạn:** Người dùng nhập thủ công số tiền lãi thực nhận. Hệ thống tạo giao dịch "Thu nhập" vào danh mục **"Lãi tiền gửi"** và cập nhật lại danh sách tiết kiệm.

---

## 3. LƯỢC ĐỒ CƠ SỞ DỮ LIỆU (SUPABASE SCHEMA)

Bảng (Tables) sẽ được lưu trữ cục bộ trên Postgrest của Supabase:
Mọi truy vấn thực hiện đều phải tuân thủ điều kiện RLS: `auth.uid() = user_id`.

- **`profiles`**: Đồng bộ với Auth Auth, lưu các tùy chọn (prefered_currency).
- **`accounts`**: `id`, `user_id`, `name`, `type`, `sub_type` (payment/savings), `balance`, `currency`, `icon`, `color_hex`.
- **`categories`**: Tập hợp danh mục thu/chi mang `user_id`.
- **`transactions`**: Chứa `amount`, `date`, `note`, `type`, `category_id`, `account_id` (Nguồn), `to_account_id` / `goal_id` (Đích).
- **`budgets`**: Liên kết `user_id`, `category_id` và độ lớn chu kỳ ngân sách hằng tháng.
- **`goals`**: Thông số mục tiêu, thanh trượt hiển thị.
- **`assets`** & **`asset_price_history`**: Thiết lập khóa ngoại `ON DELETE CASCADE` tới bảng `assets` để lưu vết dữ liệu.
- **`savings_deposits`**: Lưu trữ chi tiết tiền gửi. Các trường: `id`, `user_id`, `account_id` (FK), `purpose` (accumulation/debt_repayment), `start_date`, `term_months`, `interest_rate`, `expected_interest`, `maturity_date`, `status` (active/settled).
