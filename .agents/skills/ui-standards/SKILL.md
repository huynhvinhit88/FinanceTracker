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

Ứng dụng áp dụng **Cơ chế Nhập Đầy Đủ (Full Mode)** cho tất cả các ô số tiền thông qua hook `useCurrencyInput`:

- **Hành vi**: Nhập số thực đầy đủ (gõ `50000` -> lưu & hiển thị `50.000 ₫`, gõ `500` -> `500 ₫`). Không tự động nhân 1.000.
- **Tự động định dạng**: Tự động nhóm dấu phân cách hàng ngàn `.` giúp người dùng dễ quan sát con số chính xác mà không bị nhảy con trỏ.
- **Giao diện**: Hiển thị hậu tố ` ₫` để xác nhận đơn vị tiền tệ.
- **Kỹ thuật**: Sử dụng `inputMode="numeric"` để mở bàn phím số gọn gàng trên mobile. Luôn sử dụng hook `useCurrencyInput(initialValue, { allowNegative: boolean })`.

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

- **Số âm**: Hiển thị màu đỏ (ví dụ: chi phí).
- **Số dương**: Hiển thị màu xanh lá hoặc xanh dương (ví dụ: thu nhập, lợi nhuận).
- **Tài khoản loại Nợ (`sub_type='debt'`)**: `balance` là **số dư thực, ÂM khi đang nợ** (chi tiêu từ thẻ làm số dư âm thêm; trả nợ làm tăng về 0). Hiển thị **đúng giá trị thực** qua `formatCurrency` (số âm sẽ tự có dấu `-`, vd `-5.000.000 đ`), **KHÔNG gắn thêm dấu `-` cứng** (tránh `--`), và **tô màu đỏ** như nhãn phân loại "khoản nợ". Trong Net Worth, số dư âm này được **cộng thẳng** (tự khấu trừ), không trừ riêng. Khi nhập/sửa số dư tài khoản Nợ, ô nhập hỗ trợ **số âm** (`useCurrencyInput({ allowNegative: true })`). Tài khoản "Phải thu" (`receivable`) hiển thị giá trị dương có dấu `+` màu xanh.
- **Xác nhận**: Khi áp dụng các hồ sơ tính toán, luôn có thông báo hoặc biểu tượng (CheckCircle) để xác nhận thông tin đã được điền tự động.
