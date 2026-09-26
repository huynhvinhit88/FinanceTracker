-- MIGRATION V16: Cho phép ngân sách có amount = 0 trong Kế hoạch thu chi
--
-- Vấn đề: bảng budgets có CHECK (amount > 0) nên khi người dùng thêm hoặc sửa
-- mục kế hoạch với số tiền = 0, Supabase báo lỗi:
-- "new row for relation \"budgets\" violates check constraint \"budgets_amount_check\""
--
-- Cách chạy: dán toàn bộ nội dung này vào Supabase Dashboard > SQL Editor và ấn Run.

ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_amount_check;

ALTER TABLE budgets
  ADD CONSTRAINT budgets_amount_check
  CHECK (amount >= 0);
