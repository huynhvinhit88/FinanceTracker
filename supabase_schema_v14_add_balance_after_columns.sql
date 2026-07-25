-- MIGRATION V14: Thêm cột balance_after_source và balance_after_dest cho bảng transactions
--
-- Mục đích: Lưu giá trị số dư tài khoản ngay sau khi thực hiện giao dịch.
-- - balance_after_source: số dư của tài khoản nguồn (hoặc tài khoản duy nhất) sau giao dịch.
-- - balance_after_dest: số dư của tài khoản đích sau giao dịch (dành cho giao dịch chuyển tiền).
--
-- Cách chạy: dán toàn bộ nội dung này vào Supabase Dashboard > SQL Editor và bấm Run.

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS balance_after_source numeric;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS balance_after_dest numeric;

-- Yêu cầu PostgREST nạp lại schema cache
NOTIFY pgrst, 'reload schema';
