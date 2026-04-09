---
name: UI/UX Standards for Financial Data
description: Quy tắc hiển thị và nhập liệu số tiền, lãi suất để đảm bảo đồng nhất trải nghiệm người dùng Premium.
---

# Quy tắc Hiển thị và Nhập liệu Tài chính

Tài liệu này quy định các tiêu chuẩn về giao diện (UI) và trải nghiệm (UX) cho các thành phần liên quan đến số tiền và lãi suất trong ứng dụng Finance Tracker.

## 1. Hiển thị Số tiền (Currency Display)

- **Định dạng**: Sử dụng dấu chấm `.` làm phân cách hàng ngàn và hậu tố `₫`.
- **Hàm tiện ích**: Luôn sử dụng `formatCurrency(value)` từ `src/utils/format.js`.
- **Ví dụ**: `1.250.000 ₫`.

## 2. Nhập liệu Số tiền (Currency Input)

Ứng dụng hỗ trợ hai cơ chế nhập liệu linh hoạt thông qua hook `useCurrencyInput`:

- **Cơ chế Viết tắt (Shortcut Mode - x1000)**:
    - **Áp dụng cho**: Thêm giao dịch (Thu, Chi, Chuyển khoản) và Lập kế hoạch ngân sách (Dự thu/Dự chi hàng tháng).
    - **Hành vi**: Tự động nhân giá trị nhập với 1.000 (Ví dụ: gõ `50` -> lưu `50.000`).
    - **Giao diện**: Hiển thị hậu tố `.000 ₫` mờ ở cuối ô nhập.

- **Cơ chế Đầy đủ (Full Mode)**:
    - **Áp dụng cho**: Số dư tài khoản, Mục tiêu tiết kiệm, Sổ tiết kiệm, Tài sản đầu tư, Khoản vay, và Tab **Trả nợ** trong Thêm giao dịch.
    - **Hành vi**: Nhập số thực đầy đủ, không tự động nhân thêm.
    - **Giao diện**: Hiển thị hậu tố ` ₫` để xác nhận đơn vị tiền tệ.

- **Kỹ thuật chung**:
    - Không tự động thêm dấu phân cách hàng ngàn trong khi gõ để tránh nhảy con trỏ.
    - Sử dụng `inputMode="numeric"` để mở bàn phím số trên mobile.
    - Luôn sử dụng hook `useCurrencyInput(initialValue, { useShortcut: boolean })`.

## 3. Lãi suất (Interest Rates)

- **Phân cách thập phân**: Sử dụng dấu phẩy `,` để phân cách phần thập phân (theo tiêu chuẩn Việt Nam).
- **Nhập liệu**: 
    - Sử dụng `type="text"` và `inputMode="decimal"`.
    - Tự động chuyển đổi dấu phẩy `,` thành dấu chấm `.` khi tính toán hoặc lưu trữ.
- **Ví dụ**: `8,5%` thay vì `8.5%`.

## 4. Quản lý Vòng đời (Lifecycle)

- **Sửa và Xoá**: Tất cả các danh mục/đối tượng khi cho phép người dùng thêm mới (ví dụ: Tài khoản, Sổ tiết kiệm, Tài sản đầu tư, Khoản vay) đều **phải** được tích hợp đầy đủ chức năng **Chỉnh sửa** và **Xoá**.
- **Vị trí**: Nút Sửa/Xoá nên được đặt trong màn hình chi tiết (Detail Sheet) của đối tượng đó để giữ giao diện danh sách tinh gọn.
- **Xác nhận**: Luôn yêu cầu người dùng xác nhận (Confirm Dialog) trước khi thực hiện hành động **Xoá** để tránh mất dữ liệu nhầm.

## 5. Trạng thái và Phản hồi

- **Số âm**: Hiển thị màu đỏ (ví dụ: dư nợ, chi phí).
- **Số dương**: Hiển thị màu xanh lá hoặc xanh dương (ví dụ: thu nhập, lợi nhuận).
- **Xác nhận**: Khi áp dụng các hồ sơ tính toán, luôn có thông báo hoặc biểu tượng (CheckCircle) để xác nhận thông tin đã được điền tự động.
