# FinanceTracker PWA Bản đồ Triển khai (Implementation Plan)

Dự án này nhằm xây dựng **FinanceTracker**, một ứng dụng quản lý tài chính cá nhân toàn diện (PWA) tối ưu hóa riêng cho thiết bị di động (Mobile-only UI). Dưới đây là kế hoạch chi tiết từng bước dựa trên tài liệu Đặc tả (PRD).

## Kiến trúc Hệ thống & Công nghệ (Tech Stack)

- **Frontend:** React.js (Sử dụng Vite để build), JavaScript, **Tailwind CSS**.
- **UI Framework/Components:** Thiết kế custom bằng Tailwind CSS với kiến trúc Mobile-first. Sử dụng `framer-motion` để xử lý mượt mà các animation/cử chỉ (gestures) và `lucide-react` cho thư viện icon.
- **Backend & Database:** Supabase (PostgreSQL, Authentication, Row Level Security).
- **Hosting:** Vercel (CI/CD từ GitHub).
- **State Management:** Zustand (gọn nhẹ, phù hợp cho dữ liệu toàn cục của PWA).
- **Data Fetching:** React Query (để tối ưu hóa bộ nhớ đệm cache và đồng bộ state) kết hợp với Supabase JS Client.

## Kế hoạch Triển khai (Phased Implementation)

### Giai đoạn 1: Khởi tạo & Cấu hình Hạ tầng (Setup & Infrastructure)
- Khởi tạo dự án Vite React bằng lệnh `npx create-vite`.
- Phác thảo cấu trúc thư mục (components, pages, hooks, utils, services).
- Cài đặt hệ thống thư viện thiết yếu: `react-router-dom`, `@supabase/supabase-js`, `zustand`, `@tanstack/react-query`, `framer-motion`, `lucide-react`, `tailwindcss`.
- Thiết lập CSS căn bản trên Tailwind: Typography (Google Fonts), Màu sắc chủ đạo, Safe Areas (cho mobile).
- Xây dựng Layout cốt lõi: Bottom Tab Bar, SafeAreaWrapper, Mobile Container.

### Giai đoạn 2: Cơ sở Dữ liệu & Xác thực (Database & Auth)
- Thiết lập dự án Supabase.
- Định nghĩa Schema cơ sở dữ liệu trên Supabase (như PRD mục 3):
  - `profiles`, `accounts`, `categories`, `transactions`, `budgets`, `goals`, `assets`, `asset_price_history`, `savings_deposits`.
- Bật Row Level Security (RLS) cho tất cả các bảng.
- Tích hợp Supabase Auth vào ứng dụng (UI Đăng nhập/Đăng ký Email & Google OAuth).
- Tạo cấu trúc Protected Routes (Bảo vệ các page cần xác thực trước khi truy cập).

### Giai đoạn 3: Tiện ích Cốt lõi & Form thông minh
- Cài đặt Utilities xử lý logic *Nhập liệu x1000* áp dụng toàn cục cho các trường tiền tệ (giúp người dùng nhập 1.000 thay cho 1.000.000).
- Tạo component `BottomSheet` chung có thể tái sử dụng (có hiệu ứng trượt) cho mọi form nhập liệu.

### Giai đoạn 4: Module Quản lý Cốt lõi (Core Modules)
1. **Module 2: Ví & Tài khoản:** UI hiển thị thẻ tài khoản, chức năng CRUD thẻ, lấy balance theo realtime. Quản lý Debt được ghép chung một view.
2. **Module 4: Sổ Giao dịch (Transactions):** Giao diện thêm Thu/Chi/Chuyển khoản (có BottomSheet). Thêm tính năng Swipe to delete, tự động rollback. Tạo lệnh seed các Category mặc định ban đầu.
3. **Module 1: Dashboard:** Biểu đồ thu nhỏ, tính tổng Net Worth (Tài sản ròng), top 5 giao dịch gần đây, Nút bồng (FAB) khổng lồ ở giữa tạo giao dịch nhanh.

### Giai đoạn 5: Module Nâng cao & Đầu tư 
1. **Module 5: Mục tiêu Tiết kiệm (Goals):** Vẽ Progress bar, tạo flow nhập tiền Góp vốn tự động link từ ví khác sang tiết kiệm.
2. **Module 6 & 10: Wealth Tracker & Savings Deposits:** Quản lý tài sản (Vàng, Crypto, Chứng chỉ). Chạy tự động logic tiền gửi có kỳ hạn để nội suy ra ngày tính lãi.
3. **Module 7: Ngân sách (Budgets):** UI thanh progress ngân sách hằng tháng, đổi màu đỏ mỗi khi chi tiêu vượt định mức.

### Giai đoạn 6: Công cụ & Dự báo Tài chính
1. **Module 8: Tools (Loan Calculator):** Tool chuyên biệt để mô phỏng khoản vay. Thuật toán Amortization Schedule có tính cả phí trả trước và tất toán nợ gốc định kỳ.
2. **Module 11: Dự báo (Projection):** Thuật toán nội suy dựa trên ngân sách, số nợ và tiền gửi hiện có để vẽ biểu đồ line (Growth Chart) tài sản trên 1-120 tháng tới.

### Giai đoạn 7: Hoàn thiện & Triển khai (Polish & Deploy)
- Tối ưu hóa UI/UX: Refine màu gradient, thêm skeleton loading state khi fetch data.
- Cấu hình chuẩn PWA: `manifest.json`, icon maskable, cấu hình Service Worker bằng vite-plugin-pwa.
- Push source code lên GitHub và kết nối tự động Deploy với Vercel.

## Giai đoạn Kiểm thử theo kế hoạch (Verification Plan)
1. **Kiểm thử cục bộ (Manual QA trên trình duyệt):** Developer Tools mô phỏng Mobile Viewport.
2. **Kiểm thử logic:** Mô phỏng nhập liệu x1000 và kiểm chứng giá trị trong database Supabase, đặc biệt việc lưu chữ số lớn.
3. **Môi trường Live App:** Deploy lên Vercel và cài đặt trên điện thoại thật (Add to Homescreen) để verify trải nghiệm full-screen native-like.
