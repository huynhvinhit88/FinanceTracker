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

Để tối ưu hóa nhập liệu trên thiết bị di động (PWA), chúng ta sử dụng quy tắc "Đơn vị Nghìn":
- **Giá trị lưu trữ**: Tất cả số tiền nhập vào được hiểu là đơn vị **Nghìn đồng** (khi lưu vào DB phải nhân với 1.000).
- **Giao diện TextBox**:
    - Hiển thị 3 số không mờ (`.000 ₫`) ở phía cuối (hậu tố) để người dùng biết họ đang nhập đơn vị nghìn.
    - Không tự động thêm dấu phân cách hàng ngàn trong khi gõ (để tránh lỗi nhảy con trỏ trên mobile).
    - Sử dụng `inputMode="numeric"` để mở bàn phím số.
- **Hook hỗ trợ**: Luôn sử dụng `useCurrencyInput` từ `src/hooks/useCurrencyInput.js` để quản lý trạng thái hiển thị và giá trị thực tế.

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
