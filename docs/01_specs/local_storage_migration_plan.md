# Kế hoạch chuyển đổi Supabase sang Local Storage (IndexedDB)

Dự án sẽ chuyển đổi toàn bộ cơ chế lưu trữ dữ liệu từ đám mây (Supabase) sang lưu trữ cục bộ trên thiết bị người dùng sử dụng **IndexedDB** nhằm tăng tính riêng tư, tốc độ và khả năng sử dụng offline hoàn toàn.

## User Review Required

> [!IMPORTANT]
> **Thay đổi kiến trúc Auth:** Chúng ta sẽ chuyển từ Supabase Auth sang cơ chế **Khóa ứng dụng (App Lock)** dùng PIN hoặc Password. Chỉ hỗ trợ 1 người dùng duy nhất trên 1 thiết bị.
> **Đồng bộ Google Drive:** Sử dụng cơ chế **Thủ công + Tự động khi mở app**. Cần một Client ID từ Google Cloud Console.

## Proposed Changes

### 1. Cơ sở dữ liệu (Storage Layer)

Tất cả bảng dữ liệu hiện có trên Supabase sẽ được tái cấu trúc trong IndexedDB bằng thư viện **Dexie.js**.

#### [NEW] `frontend/src/lib/db.js`
- Định nghĩa schema cho: `settings` (lưu mã PIN/Password), `accounts`, `categories`, `transactions`, `loans`, `budgets`, `investments`, `goals`.
- Toàn bộ dữ liệu được lưu trữ trực tiếp, không cần phân tách `user_id`.
- **Yêu cầu đặc biệt:** Tích hợp việc gọi API `navigator.storage.persist()` khi khởi tạo cấu hình Dexie. Việc này xin quyền Hệ Điều Hành cấp cờ Persistent Storage, ngăn chặn trình duyệt dọn rác tự động xóa IndexedDB khi điện thoại đầy bộ nhớ.


### 2. Bảo mật truy cập (Access Control)

#### [MODIFY] `frontend/src/contexts/AuthContext.jsx`
- Lần đầu chạy app: Hiển thị màn hình thiết lập PIN/Password.
- Các lần sau: Yêu cầu mã PIN/Password để mở khóa.
- Lưu trạng thái "Đã mở khóa" vào session.
- **Lưu ý bảo mật:** DB sẽ không chạy mã hóa nội dung (No Encryption). IndexedDB lưu trữ giao dịch dạng văn bản học được (Clear-text). PIN chỉ đóng vai trò chặn giao diện (UI Lock) trên màn hình.


### 3. Cập nhật Components & Hooks

Thay thế toàn bộ các lời gọi `supabase.from(...)` bằng API của hệ thống mới.

#### [MODIFY] Tất cả file trong `frontend/src/hooks/` và `frontend/src/components/`
- Chuyển `supabase.select()`, `insert()`, `update()`, `delete()` sang các hàm tương đương trong `db.js`.
- Loại bỏ các logic rườm rà của RLS (Row Level Security) vì dữ liệu nay đã là local.

### 4. Backup & Sync (Google Drive)

#### [NEW] `frontend/src/lib/syncService.js`
- Tích hợp Google Identity Services (GSI).
- Cơ chế **Tự động Backup khi khởi động**: Phương châm là "1 thiết bị chính", không ứng dụng đồng bộ 2 chiều phức tạp (CRDTs). Khi app khởi chạy, tự động kiểm tra file lưu trên Google Drive xem có mới hơn bản trên Máy (Local) không. Nếu có, báo cho người dùng hỏi có muốn "Khôi phục" không.
- Cơ chế **Manual Export**: Nút bấm thủ công trong cài đặt để đẩy dữ liệu Local hiện tại lên Google Drive (ghi đè bản cũ).
- Sử dụng folder ẩn `appDataFolder` trên Google Drive để bảo mật file dữ liệu.

#### [MODIFY] `frontend/src/pages/Settings.jsx`
- Thêm giao diện quản lý:
    - Thay đổi mã PIN/Password.
    - Nút Xuất/Nhập file JSON (Backup DB).
    - Nút Xuất file CSV báo cáo (Lưu thủ công vào máy).
    - Cấu hình tài khoản Google Drive để đồng bộ.

---

## Open Questions
- Đã giải quyết xong tất cả các câu hỏi. Sẵn sàng thực hiện.

## Verification Plan

### Automated Tests/Pre-checks
- Kiểm tra tính tương thích của trình duyệt mobile (Safari/Chrome) với IndexedDB.
- Chạy `npm install dexie dexie-react-hooks dexie-export-import` để chuẩn bị dependencies.

### Manual Verification
1. Thiết lập PIN lần đầu thành công.
2. Thêm giao dịch -> Khóa ứng dụng -> Yêu cầu mã PIN khi mở lại.
3. Nhập sai PIN -> Báo lỗi; Nhập đúng PIN -> Vào được Dashboard và thấy dữ liệu cũ.
4. Xuất file JSON -> Xóa dữ liệu trình duyệt -> Nhập lại file JSON -> Kiểm tra dữ liệu được khôi phục.
5. Kết nối Google Drive -> Upload backup -> Kiểm tra file tồn tại trên Cloud.
