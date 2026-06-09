-- MIGRATION V11: Cho phép sub_type = 'receivable' (tài khoản Phải thu)
--
-- Vấn đề: schema gốc (supabase_schema.sql) tạo constraint
--   accounts_sub_type_check  CHECK (sub_type IN ('payment', 'savings', 'debt'))
-- Nhưng app đã bổ sung loại tài khoản "Phải thu" dùng sub_type = 'receivable'
-- (xem ACCOUNT_TYPES trong AddAccountSheet.jsx). Khi thêm tài khoản Phải thu,
-- DB từ chối với lỗi:
--   new row for relation "accounts" violates check constraint "accounts_sub_type_check"
--
-- => Cập nhật constraint để cho phép thêm 'receivable'.
--
-- Cách chạy: dán toàn bộ nội dung này vào Supabase Dashboard > SQL Editor và Run.
-- An toàn, KHÔNG làm mất dữ liệu (chỉ thay đổi constraint).

ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_sub_type_check;

ALTER TABLE accounts
  ADD CONSTRAINT accounts_sub_type_check
  CHECK (sub_type IN ('payment', 'savings', 'debt', 'receivable'));

-- Yêu cầu PostgREST nạp lại schema cache.
NOTIFY pgrst, 'reload schema';
