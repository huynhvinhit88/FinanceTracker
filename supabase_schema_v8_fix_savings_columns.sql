-- MIGRATION V8: Bổ sung các cột còn thiếu cho bảng savings
--
-- Vấn đề: bảng savings được tạo lần đầu ở v4 (create table IF NOT EXISTS) nên trên DB đang
-- chạy nó vẫn giữ cấu trúc cũ, THIẾU các cột mà schema v6 bổ sung (account_id, category_id,
-- term_unit, maturity_date, interest_type, auto_renew). Hệ quả: tạo sổ tiết kiệm báo lỗi
-- "Could not find the 'account_id' column of 'savings' in the schema cache".
--
-- Cách chạy: dán toàn bộ nội dung này vào Supabase Dashboard > SQL Editor và Run.
-- Dùng ADD COLUMN IF NOT EXISTS nên an toàn, KHÔNG làm mất dữ liệu sổ tiết kiệm hiện có.

ALTER TABLE savings ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE savings ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE savings ADD COLUMN IF NOT EXISTS term_unit text DEFAULT 'months';
-- maturity_date: KHÔNG đặt NOT NULL để tránh lỗi với các dòng cũ chưa có giá trị.
ALTER TABLE savings ADD COLUMN IF NOT EXISTS maturity_date timestamp with time zone;
ALTER TABLE savings ADD COLUMN IF NOT EXISTS interest_type text;
ALTER TABLE savings ADD COLUMN IF NOT EXISTS auto_renew boolean DEFAULT false;

-- --- Phòng ngừa: bảng transactions cũng thiếu các cột cho luồng "Trả nợ vay" ---
-- File schema v6 không khai báo loan_id / loan_payment_type / loan_principal_amount nhưng
-- code (AddTransactionSheet) có ghi vào. Thêm trước để tránh lỗi schema cache khi trả nợ.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS loan_id uuid REFERENCES loans(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS loan_payment_type text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS loan_principal_amount numeric;

-- Yêu cầu PostgREST nạp lại schema cache ngay (nếu không, có thể phải đợi vài giây).
NOTIFY pgrst, 'reload schema';
