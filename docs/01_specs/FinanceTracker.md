# FinanceTracker - Tài liệu Đặc tả Tính năng Hiện tại (PRD)

**Nền tảng:** Web App / Progressive Web App (PWA) thiết kế **chỉ dành riêng cho thiết bị Di động (Mobile-only UI)**, có hỗ trợ bố cục Desktop (Sidebar + Widgets).
**Frontend:** React 19 / JavaScript (JS), Vite 8, Tailwind CSS 4, Zustand, React Query, Recharts, Framer Motion.
**Hosting:** Vercel (Gói FREE)
**Database, Auth & Dịch vụ Backend:** **Supabase (PostgreSQL + Auth + Row Level Security)** — Gói FREE.
**Backup ngoài:** Google Drive (qua Google Identity Services / Drive API).
**Ngôn ngữ ứng dụng:** Thuần Tiếng Việt.

> **Ghi chú phiên bản:** Dự án đã được **chuyển đổi từ IndexedDB (Dexie) sang Supabase**. Toàn bộ dữ liệu hiện được lưu trên PostgreSQL của Supabase với cơ chế bảo mật RLS theo `user_id`. Lớp truy cập dữ liệu (`db.js`) được bọc trong một wrapper (`SupabaseTableWrapper`) mô phỏng API kiểu Dexie (`toArray`, `get`, `add`, `put`, `update`, `delete`, `bulkAdd`, `orderBy`, `filter`, `count`) để giữ tương thích với code cũ. Một dịch vụ di trú tự động (`migrationService.js`) sẽ phát hiện và đẩy dữ liệu IndexedDB cũ (nếu còn) lên Supabase trong lần đăng nhập đầu tiên, sau đó xoá database cục bộ.

---

## TỔNG QUAN ỨNG DỤNG
**FinanceTracker** là một ứng dụng quản lý tài chính cá nhân toàn diện, được thiết kế tối ưu cho trải nghiệm di động (Mobile-first). Ứng dụng không chỉ đơn thuần là một sổ ghi chép thu chi, mà còn là một công cụ quản lý tài sản ròng (Net Worth), theo dõi nợ vay, lập kế hoạch tiết kiệm, quản lý đầu tư và dự báo tài chính dài hạn. Với giao diện hiện đại, quy tắc nhập liệu thông minh (x1000) và khả năng tích hợp linh hoạt giữa các module, FinanceTracker giúp người dùng nắm bắt hoàn toàn bức tranh tài chính của mình và đưa ra các quyết định đầu tư, vay vốn hoặc tiết kiệm một cách sáng suốt.

---

## 1. QUY TẮC TOÀN CỤC & HỆ THỐNG CỐT LÕI

### 1.1. Tiêu chuẩn Giao diện (Mobile-UI Standards)
Ứng dụng ưu tiên trải nghiệm trên màn hình điện thoại, mô phỏng trải nghiệm của một Native App (Ứng dụng gốc):
- **Điều hướng (Navigation):** Trên Mobile dùng thanh điều hướng dưới cùng (Bottom Tab Bar) với 5 màn hình chính. Trên Desktop dùng Sidebar điều hướng (`SidebarNav`) kèm các widget phụ trợ (`DesktopWidgets`).
- **Tương tác:** Khuyến khích Cử chỉ vuốt (Swipe to delete/edit) trên các danh sách.
- **Nhập liệu (Input):** Các form điền thông tin (Thêm giao dịch, Thêm mục tiêu...) dùng Bottom Sheet (`BottomSheet`) trượt từ dưới lên để dễ thao tác bằng một tay.
- **Che lấp cạnh (Safe Area):** Padding phù hợp để tránh bị lẹm vào "Tai thỏ" (Notch) hoặc thanh Home bar trên iOS/Android.
- **Chế độ tối (Dark Mode):** Hỗ trợ chuyển đổi Sáng/Tối qua `ThemeContext`; lưu lựa chọn vào `localStorage` (key `theme`).

### 1.2. Logic Nhập liệu Tiền tệ (x1000 Multiplier)
Tối ưu hóa luồng UI/UX cho người tiêu dùng Việt Nam bằng quy tắc nhập liệu rút gọn **x1000** (qua hook `useCurrencyInput`) đối với tất cả các biểu mẫu tiền tệ:
- Người dùng chỉ cần nhập hàng nghìn (ví dụ nhập `1.000` biểu thị cho 1 triệu đồng).
- Hệ thống tự động thêm dấu chấm phân cách hàng nghìn ngay trên trường nhập liệu.
- Khi lưu vào Database (Supabase), hệ thống tự động nhân 1000 (`* 1000`) để tính toán chính xác.
- **Phạm vi áp dụng:** Thêm Giao dịch, Tài khoản, Cập nhật giá Tài sản, Mục tiêu, Ngân sách, Tiết kiệm và Tính toán khoản vay.

### 1.3. Xác thực Người dùng (Authentication)
Xây dựng dựa trên **Supabase Auth** (`AuthContext`) để bảo mật dữ liệu:
- **Đăng ký / Đăng nhập:** Hỗ trợ **Email/Password** (`signUp`, `signInWithPassword`). Khi đăng ký, hệ thống yêu cầu **xác nhận qua email** trước khi sử dụng.
- **Đăng xuất:** `signOut` xoá phiên làm việc an toàn.
- **Bảo mật truy cập:** Người dùng chưa đăng nhập bị tự động điều hướng về màn hình Đăng nhập (`ProtectedRoute`). Mọi truy vấn dữ liệu đều được bảo vệ bằng **Row Level Security (RLS)** gắn cứng với điều kiện `auth.uid() = user_id`.
- **Lưu ý:** Google OAuth **không** được dùng để đăng nhập ứng dụng — Google chỉ được dùng cho tính năng sao lưu Google Drive (xem Module 9).

### 1.4. Xử lý Số dư Tài khoản (phía Client)
Số dư tài khoản (`accounts.balance`) hiện được cập nhật **phía client** trong từng luồng nghiệp vụ (ví dụ hàm `updateAccountBalances()` trong `AddTransactionSheet.jsx`). **`balance` là số dư thực của MỌI loại ví, kể cả ví Nợ/thẻ tín dụng — ví Nợ mang giá trị ÂM khi đang nợ.** Vì vậy mọi loại ví cộng/trừ giống nhau, không còn đảo dấu cho ví nợ:
- **Income:** `+ amount` vào tài khoản (mọi loại).
- **Expense / Transfer / Trả nợ:** `- amount` khỏi tài khoản nguồn (ví nợ sẽ âm thêm — vd thẻ đang `0`, chi `50` → `-50`).
- **Transfer:** đồng thời `+ amount` vào tài khoản đích `to_account_id` (trả nợ thẻ = chuyển tiền vào ví nợ → số dư âm tăng dần về 0).
- Khi **Sửa/Xoá** giao dịch: client rollback giá trị cũ (`direction = -1`) rồi áp dụng giá trị mới.
- **Net Worth:** số dư ví Nợ (âm) được **cộng thẳng** cùng các tài khoản khác (âm tự khấu trừ), KHÔNG còn tính riêng vào mục "Liabilities" (tránh trừ hai lần). Khi sửa tài khoản Nợ đang nợ, nhập **số âm** (ô số dư hỗ trợ dấu `-` qua `useCurrencyInput({ allowNegative: true })`).

> 🐞 **Bug số dư sai sau khi chuyển sang Supabase (đã sửa):** PostgREST/Supabase trả các cột `numeric` (như `accounts.balance`, `transactions.amount`) dưới dạng **chuỗi**. Thời còn dùng Dexie chúng là số, nên phép `balance + diff` từng cộng số; với chuỗi nó **nối chuỗi** (vd `"1000000" + 50000 → "100000050000"`), khiến số dư sai sau mỗi giao dịch. Đã khắc phục bằng cách ép kiểu number cho các cột số ngay khi đọc trong [lib/db.js](../../frontend/src/lib/db.js) (`coerceNumericFields`/`NUMERIC_FIELDS`). *Số dư đã bị sai từ trước fix cần chỉnh tay qua màn hình Sửa tài khoản.*

> ⚠️ **Cảnh báo lệch pha schema:** File [supabase_schema_v6_full_auth.sql](../../supabase_schema_v6_full_auth.sql) có chứa trigger `process_transaction()` cũng cập nhật số dư phía server. **Nếu trigger này được bật trên DB đang chạy, số dư sẽ bị cộng đôi** (cả client lẫn server cùng cập nhật) — và trigger không đảo dấu cho ví Nợ nên càng sai. Đã bổ sung [supabase_schema_v10_disable_balance_trigger.sql](../../supabase_schema_v10_disable_balance_trigger.sql) để **gỡ trigger** này; chạy file đó trên Supabase SQL Editor để đảm bảo chỉ client quản lý số dư. Xem thêm phần ghi chú ở Mục 3.

---

## 2. CHI TIẾT TỪNG MODULE CHỨC NĂNG

> **Cấu trúc điều hướng (5 Tab chính):** `Tổng quan` (Home) · `Tài khoản` (Accounts) · `Kế hoạch` (Plan) · `Thống kê` (Statistics) · `Cài đặt` (Settings). Màn hình **Danh sách Giao dịch** (`/transactions`) là màn hình độc lập (không có Tab Bar).

### Module 1: Trang chủ / Tổng quan (Dashboard — `Home.jsx`)
Hiển thị ngay khi mở app, thân thiện, dễ nhìn bằng một tay.
- **Tài sản Ròng (Net Worth):** Tự động tính toán và phân rã thành 4 thành phần:
  - Tài sản thanh khoản (tổng số dư tài khoản thanh toán/tiết kiệm).
  - Tài sản đầu tư ròng (giá thị trường trừ nợ liên kết).
  - Khoản phải thu (Receivables).
  - Trừ đi Tổng nợ vay + Nợ thẻ/Sổ nợ (Liabilities).
- **Cơ cấu chi tiêu tháng hiện tại:** Biểu đồ tròn (Pie Chart) phân tích chi tiêu theo danh mục kèm tỷ lệ %.
- **Giao dịch gần đây:** Danh sách ~20 giao dịch mới nhất, phân loại Thu / Chi / Chuyển.
- **Lối tắt thao tác:** Nút cộng nổi (Floating Action Button - FAB) để "Thêm Giao dịch" nhanh. Nút này **hiển thị cố định trên tất cả các trang** (Tổng quan, Tài khoản, Kế hoạch, Thống kê, Cài đặt và cả màn hình Sổ giao dịch); sau khi thêm giao dịch thành công, trang đang mở tự cập nhật lại số liệu.

### Module 2: Quản lý Ví & Tài khoản (Accounts — `Accounts.jsx`)
Màn hình tổ chức theo **4 Tab**: **Tiền mặt**, **Tiết kiệm**, **Đầu tư**, **Nợ vay** (tab Nợ vay nằm bên phải tab Đầu tư).
- **Phân loại Tài khoản (`type`):** Tiền mặt, Ngân hàng, Ví điện tử, Thẻ tín dụng, Khoản nợ, Phải thu.
- **Loại con (`sub_type`):** `payment` (thanh toán), `savings` (tiết kiệm), `debt` (sổ nợ/thẻ tín dụng), `receivable` (phải thu).
- **Tab Tiền mặt:** 4 thẻ tóm tắt (TK Thanh toán, Phải thu, TK Tiết kiệm, Sổ nợ/Thẻ tín dụng); danh sách ví phân nhóm.
- **Tab Tiết kiệm:** 2 thẻ tổng (Khối lượng tiết kiệm, Tổng lãi dự kiến); danh sách sổ tiết kiệm với lãi dự kiến, kỳ hạn, ngày đáo hạn (sắp xếp sổ `active` sắp đáo hạn trước), hỗ trợ **nhóm danh sách** theo: Không nhóm / Theo tài khoản / Theo danh mục / Theo tháng tất toán; và phần **Phân tích Tiết kiệm** (cơ cấu theo hạng mục/tài khoản, lịch trình đáo hạn — chuyển từ trang Thống kê) (xem chi tiết ở Module 10).
- **Tab Đầu tư:** 2 thẻ tóm tắt (Tài sản ròng/Equity & Tổng thị trường); danh sách tài sản đầu tư kèm % lợi nhuận.
- **Tab Nợ vay:** 1 thẻ tóm tắt (Tổng dư nợ); danh sách khoản vay `active` kèm tiến độ trả, và mục "Đã tất toán" cho các khoản `paid_off` (chi tiết khoản vay ở Module 8).
- **Tuỳ biến:** Chọn biểu tượng (Icons) và màu sắc (Color Hex). Cờ `include_in_net_worth`, `is_default`, `status`.

### Module 3: Quản lý Sổ Nợ / Thu Chi Hộ (Debt Management)
Được tích hợp vào màn hình Tài khoản (tài khoản `sub_type = debt` / `receivable`) để không làm rườm rà Tab Bar.
- **Khoản Phải Thu (`receivable`):** Tiền người khác nợ mình.
- **Khoản Cần Trả (`debt`):** Tiền mình đang nợ (gồm thẻ tín dụng).
- Dễ dàng tạo Giao dịch thu/trả nợ liên quan. Đối soát Thu hộ/Chi hộ được hỗ trợ tại màn hình Thống kê.

### Module 4: Sổ Giao dịch (Transactions & History — `TransactionsList.jsx`, `AddTransactionSheet.jsx`)
Màn hình lõi thao tác nhiều nhất của người dùng.
- **Phân loại Giao dịch:** Thu (`income`), Chi (`expense`), Chuyển khoản nội bộ (`transfer`), và chế độ **Trả nợ** (repayment — biến thể của transfer/expense gắn với khoản vay).
- **Hệ thống Danh mục (Categories):** Lựa chọn danh mục theo loại; phân cấp qua `parent_id`.
  - **Khởi tạo mặc định (`seedDefaultData`):** Ứng dụng tự tạo sẵn các danh mục cơ bản theo đúng thứ tự hiển thị:
    - *Chi (expense):* Sinh hoạt (mặc định — `is_ui_default`), Gửi về nhà, Chi hộ, Nhà ở, Trả nợ vay, Học tập, Du lịch, Mua sắm đồ giá trị, Quà cáp, Cho mượn, Y tế, Nhà cho thuê, Chi điều chỉnh.
    - *Thu (income):* Lương (mặc định), Cho thuê, Thu hồi nợ, Lãi tiết kiệm, Thu hộ, Cash back, Thưởng, Thu điều chỉnh.
    - *Chuyển khoản (`type = savings`):* Tiết kiệm (mặc định), Nhà ở TK, Má gửi, Tất toán sổ tiết kiệm, Luân chuyển.
    - **Đồng bộ theo phiên bản:** `seedDefaultData` chạy lại khi `settings.category_seed_version` ≠ `CATEGORY_SEED_VERSION` — thêm/cập nhật danh mục mặc định theo `type|name` (giữ nguyên `id` để không mất tham chiếu giao dịch) và xóa danh mục mặc định cũ không còn trong danh sách (chỉ `is_default`, giữ lại danh mục người dùng tự tạo). Người dùng có toàn quyền thêm/sửa/xoá (xem Module 9).
- **Mặc định khi mở form:** Khi nhấn "+" để thêm giao dịch, form mặc định mở tab **Chi** với một danh mục **sinh hoạt** (`is_ui_default`, hoặc danh mục chi đầu tiên không phải "Trả nợ vay"). Chế độ Trả nợ chỉ kích hoạt khi người dùng chọn tab "Trả nợ" hoặc danh mục "Trả nợ vay".
- **Chế độ Trả nợ thông minh:** Khi chọn khoản vay, hệ thống gọi `calculateLoanSchedule()` để gợi ý số tiền gốc + lãi của kỳ hiện tại (Trả định kỳ) hoặc toàn bộ dư nợ + lãi + phí phạt (Tất toán).
- **Ghi chú Thông minh:** Tự sinh note tiếng Việt cho các thao tác đặc thù (ví dụ "Góp quỹ: [Tên mục tiêu]", "Mở sổ tiết kiệm: [Tên]").
- **Lịch sử & Hoàn tác:** Danh sách cuộn vô hạn (Infinite Scroll, ~20 mục/lần), nhóm theo ngày. Bộ lọc theo **loại giao dịch** (Tất cả/Chi/Thu/Chuyển), **thời gian** (Tất cả/Theo tháng/Theo ngày) và **tài khoản** (Tất cả/từng tài khoản — với giao dịch chuyển tiền, khớp cả tài khoản nguồn lẫn đích). Khi sửa/xoá giao dịch, client tự khôi phục số dư ví (Rollback balance) chính xác (xem Mục 1.4).

### Module 5: Mục tiêu Tiết kiệm (Savings Goals — `AddGoalSheet.jsx`, `FundGoalSheet.jsx`)
- **Theo dõi Tiến độ:** Biểu thị bằng thanh tiến trình ngang (Progress bar) dựa trên `current_amount / target_amount`.
- **Thông tin mục tiêu:** Tên, số tiền cần đạt, deadline (tuỳ chọn), icon, màu sắc.
- **Chức năng Góp vốn (`FundGoalSheet`):** Nhập số tiền + chọn ví nguồn → tạo giao dịch chi với note "Góp quỹ: [Tên]" → cộng dồn vào `current_amount` và trừ số dư ví nguồn.

### Module 6: Danh mục Đầu tư & Assets (Wealth Tracker — `investments` table)
- **Phân loại Tài sản (`type`):** Vàng (`gold`), Tiền điện tử (`crypto`), Chứng khoán (`stock`), Bất động sản (`real_estate`), Khác (`other`).
- **Nhập liệu độc lập:** Số lượng (`quantity`) và đơn vị (Chỉ, Cổ phần, BTC...), giá vốn (`buy_price`) và giá thị trường hiện tại (`current_price`).
- **Bất động sản:** Nhập Vốn tự có / Tổng giá trị hiện tại / Số tiền vay (`loan_amount`); hệ thống hiển thị Tài sản ròng = Tổng giá trị − Nợ vay.
- **Lợi nhuận:** `Lợi nhuận (%) = (current_price − buy_price) / buy_price × 100`.
- **Cập nhật Tỷ giá:** Mở Bottom Sheet cài đặt lại giá hiện tại do người dùng tự ước lượng (`EditInvestmentSheet`).
- **Liên kết khoản vay:** Một tài sản (thường là BĐS) có thể được gắn với một khoản vay (Module 8).

### Module 7: Kế hoạch & Ngân sách (Plan & Budgeting — `Plan.jsx`, `AddBudgetSheet.jsx`)
Màn hình **Kế hoạch** gộp lập ngân sách và dự báo tài chính, có **2 chế độ xem**: **Mặc định** (kế hoạch chung cho mọi tháng) và **Theo tháng** (so sánh với thực tế).
- **Lập Kế hoạch (`budgets`):** Đặt **Dự chi** cho danh mục chi (gồm cả nhóm tiết kiệm) và **Dự thu** cho danh mục thu. Áp dụng cho "Mặc định" (`month = null`) hoặc một tháng cụ thể (`month = 'YYYY-MM'`). Ràng buộc duy nhất theo `(user_id, category_id, month)`.
- **Chế độ Theo tháng:** Thẻ tóm tắt (Dự thu, Dự chi, Dự kiến tiết kiệm, Thặng dư = Thu − Chi); Progress bar so sánh thực tế với kế hoạch, **đỏ khi vượt ngưỡng 100%**.
- **Dự báo Tài chính (tích hợp):** Bảng dự báo dài hạn (tới ~60 tháng) gồm Tháng, Dự thu, Dự chi, Dư ra, Tổng tích lũy.
  - **Cột "Tổng tích luỹ":** Bắt đầu từ **tháng hiện tại** và cộng dồn "Dư ra" (hoặc giá trị ghi đè) của từng tháng. Giá trị nền (base) là **tổng tích luỹ thực đến TRƯỚC tháng hiện tại** = `Tổng tích luỹ thực − Tích luỹ dự kiến của tháng hiện tại`, trong đó *tổng tích luỹ thực* là tổng gốc các sổ có danh mục "Tiết kiệm" còn hoạt động, còn *tích luỹ dự kiến của tháng hiện tại* = `Thu dự kiến − Chi dự kiến` của tháng hiện tại. Do hai số hạng "tích luỹ dự kiến của tháng hiện tại" triệt tiêu nhau nên **hàng tháng hiện tại = đúng tổng tích luỹ thực hiện có**, phần dự kiến chỉ cộng dồn từ tháng kế tiếp (tránh cộng đôi).
  - **Thuật toán lãi kép hàng tháng:** `Tài sản tháng kế = Tài sản hiện tại × (1 + lãi suất hàng tháng) + Thặng dư tháng`, trong đó lãi suất hàng tháng ước lượng từ lãi dự kiến của tiết kiệm & đầu tư chia 12.
  - **Ghi đè thặng dư:** Cho phép người dùng ghi đè giá trị thặng dư/tiết kiệm kỳ vọng cho từng tháng (lưu trong `settings`/localStorage theo `user_id`).
  - **Biểu đồ tăng trưởng:** Đường cong tài sản biến thiên theo thời gian.

### Module 8: Khoản vay & Công cụ tài chính (Loans & Financial Tools)
Quản lý khoản vay thực tế (`loans` table) và các công cụ mô phỏng. Logic tính toán tập trung tại `utils/loanCalculator.js`.

**8.1. Khoản vay thực tế (`AddLoanSheet`, `LoanDetailSheet`):**
- **Thông tin khế ước:** Tên, số tiền vay, kỳ hạn (tháng), ngày giải ngân, ngày trả đầu tiên, loại (`borrow`/`lend`).
- **Lãi suất:** Lãi ưu đãi (%/năm) + thời gian ưu đãi; hoặc Lãi cơ sở + Biên độ → Lãi thả nổi = `base_rate + margin_rate`.
- **Kế hoạch tất toán sớm:** Phí phạt theo năm (chuỗi %/năm), ngân sách trả nợ hàng tháng, ngưỡng kích hoạt tất toán.
- **Kế hoạch theo Giai đoạn (tuỳ chọn):** Khai báo nhiều giai đoạn (Từ kỳ → Đến kỳ, lãi suất, ngân sách) — ưu tiên hơn cấu hình lãi đơn.
- **Liên kết tài sản:** Gắn khoản vay với một tài sản đầu tư (BĐS).
- **Chi tiết khoản vay:** Hiển thị dư nợ, % đã trả (progress), kỳ hạn còn lại, tổng lãi dự kiến và **Bảng lịch trả nợ (Amortization Schedule)** chi tiết từng kỳ (Gốc, Lãi, Tổng, Tất toán, Ví tích lũy, Dư nợ); nút "Ghi nhận trả nợ" mở `AddTransactionSheet`.

**8.2. Tính toán khoản vay (`LoanCalculatorSheet` — mô phỏng):**
- Cùng bộ thông số như khoản vay thực tế, cho phép mô phỏng trước khi cam kết.
- **Hồ sơ (Profiles):** Lưu/Nạp/Xoá các kịch bản mô phỏng trong `localStorage` (theo `user_id`).
- **Kết quả mô phỏng:** Dòng tiền tháng đầu, tổng thời gian thực tế, ngày tất toán dự kiến, tiền lãi tiết kiệm được, số tháng rút ngắn, tổng phí tất toán, tổng lãi. Có thể "Kích hoạt Hồ sơ vay thực tế" → đẩy sang `AddLoanSheet`.
- **Cơ chế nâng cao trong `calculateLoanSchedule()`:** mô phỏng kết hợp giao dịch lịch sử thực tế (anchoring dư nợ theo DB), tra phí phạt theo năm, miễn gốc khi trả thêm (bù trừ kỳ hạn), ví tích lũy và tất toán tự động khi đạt ngưỡng.

**8.3. Lãi kép (`CompoundInterestSheet`):**
- Nhập vốn ban đầu, góp thêm hàng tháng, lãi suất (%/năm), thời gian (năm).
- Công thức: `FV = P × (1 + r/n)^(n·t) + PMT × [((1 + r/n)^(n·t) − 1) / (r/n)]`; hiển thị Tổng tài sản, Tổng vốn, Lãi kép sinh ra.

### Module 9: Cài đặt Hệ thống & Quản lý Dữ liệu (Settings — `Settings.jsx`)
- **Công cụ tài chính:** Lối vào "Tính lãi khoản vay" và "Sức mạnh lãi kép".
- **Quản lý Danh mục (`CategoryManagementSheet`):** 3 tab (Khoản chi / Khoản thu / Chuyển khoản). Thêm/Sửa/Xoá; chọn icon (emoji) và 1 trong 10 màu preset; đặt danh mục mặc định (`is_ui_default`); sắp xếp thứ tự (`sort_order`) bằng di chuyển lên/xuống. Khi xoá danh mục: xoá budget liên quan và set `category_id = null` cho transactions.
- **Sao lưu Google Drive (`syncService.js`):** Đăng nhập Google (Google Identity Services), chọn thư mục Drive, **đẩy/khôi phục** bản backup JSON (`finance_tracker_backup.json` trong `appDataFolder` hoặc file có timestamp trong thư mục tuỳ chọn). Kiểm tra bản backup mới hơn trên Drive (`checkRemoteBackup`) và lưu mốc `lastDriveSync`. Cấu hình thư mục Drive (`googleDriveFolder`, object `{id, name}`) được lưu trong `settings`; vì cột `settings.value` kiểu **TEXT**, mọi giá trị object phải được stringify khi ghi và parse khi đọc (xử lý tập trung ở `SupabaseTableWrapper`) — nếu không, lựa chọn thư mục sẽ **không lưu được và mất sau khi reload**.
- **Xuất báo cáo (CSV):** Chọn loại dữ liệu để xuất (Giao dịch, Tài khoản, Mục tiêu, Khoản vay, Dự báo).
- **Sao lưu/Khôi phục JSON thủ công:** Export toàn bộ bảng + dữ liệu localStorage liên quan (loan profiles, savings plan, theme) ra file; Import hỗ trợ **tương thích ngược** với định dạng backup Dexie cũ (tự chuyển đổi qua `convertDexieFormat`). Thư mục cục bộ tùy chọn (File System Access API — `FileSystemDirectoryHandle`) được lưu trong **IndexedDB cục bộ** (`localHandleStore.js`), không phải Supabase, vì handle không serialize được sang JSON (mỗi thiết bị một handle riêng).
- **Quản lý Dữ liệu:** Xoá trắng toàn bộ dữ liệu cá nhân (giao dịch, tài khoản, mục tiêu, tiết kiệm, đầu tư, vay, ngân sách, settings và mọi danh mục) qua `handleWipeData` (2 lần xác nhận). Riêng danh mục được **đặt lại về đúng bộ mặc định của app**: sau khi xoá sạch sẽ gọi `seedDefaultData()` tạo lại `DEFAULT_CATEGORIES` (vì settings — gồm `category_seed_version` — đã bị xoá), do đó danh mục tự tạo/lạ/trùng sẽ biến mất, chỉ còn danh mục mặc định. Hiển thị mốc "cập nhật lần cuối" (`last_updated_at`) — mốc này được **tự động ghi nhận mỗi khi dữ liệu thay đổi** (thêm/sửa/xoá ở mọi bảng trừ `settings`) thông qua `touchLastModified()` (debounce).
- **Giao diện:** Toggle Dark Mode.
- **Bảo mật:** Đăng xuất; **Đổi mật khẩu** (`ChangePasswordSheet`) — xác minh mật khẩu hiện tại bằng `signInWithPassword` rồi cập nhật qua `supabase.auth.updateUser({ password })` (tối thiểu 6 ký tự).

### Module 10: Quản lý Tiền gửi tiết kiệm (Savings Deposits — `savings` table, `AddSavingsSheet`)
Quản lý chuyên sâu các khoản tiền gửi có kỳ hạn để tối ưu hóa lợi nhuận.
- **Thông tin quản lý:** Tên sổ (tự sinh từ tài khoản + danh mục + ngày, có thể sửa), số tiền gốc (`principal_amount`), lãi suất (%/năm), kỳ hạn (`term_months`, đơn vị `term_unit`), ngày bắt đầu, ngày đáo hạn (tự tính), tài khoản nguồn, danh mục (tuỳ chọn), `auto_renew`, `status`.
- **Mở sổ:** Kiểm tra số dư tài khoản ≥ gốc; trừ tiền và tạo giao dịch transfer note "Mở sổ tiết kiệm: [Tên]".
- **Tính toán tự động:**
  - **Tiền lãi dự kiến:** `Số tiền gốc × (Lãi suất / 100) × (Kỳ hạn / 12)`.
  - **Ngày đáo hạn:** `Ngày bắt đầu + Kỳ hạn`.
- **Danh sách sổ (tab Tiết kiệm — `Accounts.jsx`):** Hiển thị các sổ tiết kiệm dạng thẻ. Có bộ chọn cách nhóm danh sách (filter chips): **Không nhóm** (mặc định, danh sách phẳng — sổ đang hoạt động lên trước, sắp theo ngày đáo hạn), **Theo tài khoản** (gom theo tài khoản nguồn, sắp theo tên TK; sổ không gắn TK gom vào "Không rõ tài khoản"), **Theo danh mục** (gom theo danh mục tiết kiệm `category_id`, sắp theo tên danh mục; sổ không có danh mục đẩy xuống nhóm "Chưa phân loại" ở cuối), **Theo tháng tất toán** (gom theo tháng đáo hạn `YYYY-MM`, sắp tăng dần; sổ thiếu ngày đáo hạn đẩy xuống nhóm "Chưa rõ ngày tất toán" ở cuối). Mỗi nhóm hiển thị tiêu đề + số sổ + tổng tiền gốc của các sổ **đang hoạt động** trong nhóm.
- **Phân tích Tiết kiệm (tại tab Tiết kiệm — `Accounts.jsx`):** Nằm ngay dưới danh sách sổ (chỉ tính trên sổ `active`). Gồm: 2 thẻ tổng (Khối lượng tiết kiệm = tổng gốc, Tổng lãi dự kiến); **Cơ cấu theo Hạng mục** (gom theo danh mục tiết kiệm); **Cơ cấu theo Tài khoản** — mỗi tài khoản hiển thị dòng tổng *kèm phần chia nhỏ theo từng danh mục bên trong tài khoản đó* (ví dụ Tiết kiệm, Nhà ở TK…); **Lịch trình nhận tiền** (biểu đồ thanh xếp chồng gốc + lãi theo tháng đáo hạn + danh sách). Mỗi mục bấm vào mở BottomSheet liệt kê các sổ liên quan. *(Trước đây nằm ở trang Thống kê, đã chuyển sang đây.)*
- **Tái tục (Reinvestment):** Khi tất toán, có thể bật **Tái tục sang sổ mới** (tự mở sổ mới cùng lãi suất & kỳ hạn, tên gắn hậu tố "(Tái tục)"). Trong chế độ tái tục có thêm tùy chọn **Gộp cả tiền lãi vào sổ mới (lãi kép)**:
  - *Tái tục chỉ gốc:* sổ mới có gốc = gốc cũ; tiền lãi nhận về tài khoản (giao dịch Thu nhập).
  - *Tái tục gốc + lãi:* sổ mới có gốc = gốc cũ + lãi; **không** cộng tiền vào tài khoản và **không** tạo giao dịch nhận lãi.
- **Tái tục tự động (`auto_renew`):** Khi mở/sửa sổ có thể bật **Tái tục tự động khi đáo hạn** kèm tùy chọn lãi kép (`auto_renew_compound`). Vì app chạy thuần client, việc tái tục được xử lý theo kiểu **tự quét khi mở app** (`lib/savingsService.js` → `processAutoRenewals`, gọi trong `AuthContext` sau đăng nhập): mỗi sổ `active` bật cờ và đã quá ngày đáo hạn sẽ tự tất toán + mở sổ mới (lặp đủ số kỳ nếu quá hạn nhiều kỳ), dùng **lãi dự kiến**. Thẻ sổ trong tab Tiết kiệm hiển thị nhãn "Tái tục tự động" (kèm "(lãi kép)" nếu bật). Cột mới: `savings.auto_renew_compound` (chạy `supabase_schema_v9_savings_auto_renew_compound.sql`).

### Module 11: Thống kê & Báo cáo (Statistics — `Statistics.jsx`)
Công cụ phân tích chuyên sâu, gồm các phần chính:
- **Thu nhập & Chi tiêu (YTD):** Thẻ Tổng thu, Tổng chi, Tích lũy ròng; biểu đồ thanh dòng tiền 12 tháng; biểu đồ tròn cơ cấu chi tiêu top danh mục; bảng chi tiết theo tháng.
- **Đối soát Thu hộ / Chi hộ:** 3 thẻ (Tổng thu hộ, Tổng chi hộ, Chênh lệch = Chi hộ − Thu hộ); bảng chênh lệch theo tháng; diễn giải đang ứng tiền hay giữ tiền hộ.

> **Lưu ý:** Phần **Tài sản & Tiết kiệm** (cơ cấu theo hạng mục/tài khoản, lịch trình đáo hạn) trước đây ở trang này **đã được chuyển sang tab Tiết kiệm của màn hình Tài khoản** (xem Module 10).

---

## 3. LƯỢC ĐỒ CƠ SỞ DỮ LIỆU (SUPABASE SCHEMA)

Tất cả các bảng lưu trên PostgreSQL của Supabase. Mọi truy vấn tuân thủ RLS: `auth.uid() = user_id` (riêng `profiles` dùng `auth.uid() = id`). Schema mới nhất nằm tại [supabase_schema_v6_full_auth.sql](../../supabase_schema_v6_full_auth.sql).

- **`profiles`**: `id` (FK `auth.users`, khoá chính), `display_name`, `currency` (mặc định `VND`), `created_at`. Tự tạo qua trigger `handle_new_user()` khi đăng ký.
- **`accounts`**: `id`, `user_id`, `name`, `type`, `sub_type` (`payment`/`savings`/`debt`/`receivable`), `balance`, `currency`, `icon`, `color_hex`, `is_default`, `include_in_net_worth`, `status`, `created_at`.
- **`categories`**: `id`, `user_id`, `name`, `type` (`income`/`expense`/`transfer`/`savings`), `icon`, `color_hex`, `parent_id` (tự tham chiếu), `is_default`, `is_ui_default`, `sort_order`, `created_at`. **Lưu ý:** danh mục "Chuyển khoản" dùng `type = 'savings'`. CHECK constraint của cột phải bao gồm `'savings'` — nếu DB đang chạy được tạo từ schema cũ (chỉ `income/expense/transfer`), cần `ALTER TABLE` thủ công (xem `supabase_schema_v7_allow_savings_category.sql`), nếu không các danh mục chuyển khoản mặc định sẽ bị từ chối khi seed.
- **`transactions`**: `id`, `user_id`, `account_id` (nguồn), `category_id`, `to_account_id` (đích — chỉ cho transfer), `amount` (>0), `type` (`income`/`expense`/`transfer`), `date`, `note`, `tags`, `created_at`. **Code còn dùng thêm các cột `loan_id`, `loan_payment_type`, `loan_principal_amount`** (cho luồng trả nợ) — các cột này *không* có trong file schema v6 (xem ghi chú lệch pha bên dưới).
- **`loans`**: `id`, `user_id`, `account_id`, `name`, `total_amount`, `interest_rate`, `term_months`, `start_date`, `type` (`borrow`/`lend`), `status`, `minimum_payment`, `payment_date`, `interest_type`, `next_payment_amount`, `created_at`. **Code còn dùng thêm:** `remaining_principal`, `linked_investment_id`, `promo_rate`, `promo_months`, `base_rate`, `margin_rate`, `penalty_config`, `first_payment_date`, `extra_payment`, `offset_threshold`, `periods` — các cột này *không* có trong file schema v6.
- **`budgets`**: `id`, `user_id`, `category_id`, `amount` (>0), `month` (`YYYY-MM` hoặc `null` = mặc định), `type`, `created_at`. Ràng buộc duy nhất `(user_id, category_id, month)`.
- **`investments`**: `id`, `user_id`, `account_id`, `symbol`, `name`, `type` (`gold`/`crypto`/`stock`/`real_estate`/`other`), `buy_price`, `quantity`, `purchase_date`, `current_price`, `initial_amount`, `maturity_date`, `interest_rate`, `interest_type`, `auto_renew`, `status`, `return_rate`, `loan_amount`, `created_at`.
- **`savings`**: `id`, `user_id`, `account_id`, `category_id`, `name`, `principal_amount` (>0), `interest_rate`, `term_months`, `term_unit`, `start_date`, `maturity_date`, `interest_type`, `auto_renew`, `status`, `created_at`.
- **`goals`**: `id`, `user_id`, `name`, `target_amount` (>0), `current_amount`, `deadline`, `icon`, `color_hex`, `status`, `created_at`.
- **`settings`**: Khoá chính tổng hợp `(key, user_id)`, `value`. Lưu các cờ/tuỳ chọn như `has_seeded_categories`, `last_updated_at`, `lastDriveSync`, `localDirectoryHandle`...

> **Lưu ý di trú:** So với phiên bản đặc tả trước, hệ thống **không** sử dụng các bảng `asset_price_history` hay `savings_deposits` riêng biệt; lịch sử/tài sản đầu tư được quản lý qua bảng `investments`, còn tiền gửi tiết kiệm qua bảng `savings`. Các file SQL `supabase_schema.sql` → `supabase_schema_v6_full_auth.sql` ghi lại quá trình tiến hoá schema.

> ⚠️ **LỆCH PHA GIỮA SQL VÀ CODE (cần xử lý):** File `supabase_schema_v6_full_auth.sql` hiện **không khớp** với những gì code đang dùng:
> 1. **Thiếu cột:** Code đọc/ghi nhiều cột mà v6 không định nghĩa — `transactions.loan_id`, `transactions.loan_payment_type`, `transactions.loan_principal_amount`; `loans.remaining_principal`, `loans.linked_investment_id`, `loans.promo_rate/promo_months/base_rate/margin_rate/penalty_config/first_payment_date/extra_payment/offset_threshold/periods`. Ngoài ra **bảng `savings` tạo lần đầu ở v4** (`create table if not exists`) nên trên nhiều DB đang chạy vẫn thiếu các cột v6 bổ sung: `account_id`, `category_id`, `term_unit`, `maturity_date`, `interest_type`, `auto_renew` — triệu chứng: tạo sổ tiết kiệm báo lỗi *"Could not find the 'account_id' column of 'savings' in the schema cache"*. Chạy `supabase_schema_v8_fix_savings_columns.sql` để bổ sung (an toàn, dùng `ADD COLUMN IF NOT EXISTS`; file cũng thêm sẵn 3 cột loan cho `transactions`).
> 2. **CHECK constraint `categories.type`:** DB tạo từ schema cũ chỉ cho phép `income/expense/transfer` → danh mục Chuyển khoản (`savings`) bị từ chối khi seed. Chạy `supabase_schema_v7_allow_savings_category.sql` để nới constraint.
> 3. **Trigger cộng đôi:** v6 tạo trigger `process_transaction()` cập nhật số dư phía server, nhưng code đã tự cập nhật số dư phía client (Mục 1.4). Hai cơ chế này **xung đột**. Chạy `supabase_schema_v10_disable_balance_trigger.sql` để gỡ trigger + hàm này khỏi DB (đảm bảo chỉ client quản lý số dư).
> 4. **Cột số trả về dạng chuỗi:** PostgREST serialize cột `numeric` thành chuỗi → phép cộng số dư bị nối chuỗi. Đã ép kiểu number khi đọc trong `lib/db.js` (xem ghi chú bug ở Mục 1.4).
> 
> **Khuyến nghị:** Đồng bộ lại một file schema "nguồn sự thật" duy nhất phản ánh đúng DB đang chạy (đầy đủ cột + bỏ trigger), để tránh việc chạy lại `v6` làm hỏng dữ liệu. Các file `v7`/`v8`/`v9`/`v10` là bản vá tăng dần cho các DB hiện hữu.

---

## 4. KIẾN TRÚC MÃ NGUỒN (Tham khảo)

- **`lib/supabaseClient.js`**: Khởi tạo Supabase client từ biến môi trường `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **`lib/db.js`**: Lớp truy cập dữ liệu `SupabaseTableWrapper` (API kiểu Dexie), seed danh mục mặc định, cập nhật `last_updated_at`.
- **`lib/syncService.js`**: Backup/restore JSON, tích hợp Google Drive, xuất file, tương thích ngược định dạng Dexie cũ.
- **`lib/migrationService.js`**: Di trú dữ liệu IndexedDB (Dexie) cũ → Supabase trong lần đăng nhập đầu tiên.
- **`contexts/AuthContext.jsx`**: Quản lý phiên Supabase Auth; **`contexts/ThemeContext.jsx`**: Dark mode.
- **`utils/loanCalculator.js`**: Toàn bộ logic tính lịch trả nợ & tất toán sớm. **`utils/format.js`**: Định dạng tiền tệ/ngày. **`hooks/useCurrencyInput.js`**: Logic nhập liệu x1000. **`hooks/useLoans.js`**: Hook dữ liệu khoản vay.
- **Biến môi trường cần thiết:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_CLIENT_ID` (cho Drive backup).
