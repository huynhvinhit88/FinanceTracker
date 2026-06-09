-- MIGRATION V13: Bổ sung các cột còn thiếu cho bảng loans
--
-- Vấn đề: database được tạo từ schema cũ — bảng loans thiếu nhiều cột mà app ghi vào
--   (AddLoanSheet.jsx / LoanDetailSheet.jsx / useLoans.js).
-- nên PostgREST báo lỗi:
--   Could not find the 'total_amount' column of 'loans' in the schema cache
--
-- => Thêm đầy đủ các cột mà app sử dụng. Dùng IF NOT EXISTS nên an toàn nếu
--    một số cột đã tồn tại; KHÔNG làm mất dữ liệu.
--
-- Cách chạy: dán toàn bộ nội dung này vào Supabase Dashboard > SQL Editor và Run.

ALTER TABLE loans ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS principal_amount numeric DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS remaining_principal numeric DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS interest_rate numeric DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS term_months integer DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS start_date timestamp with time zone DEFAULT timezone('utc'::text, now());
ALTER TABLE loans ADD COLUMN IF NOT EXISTS first_payment_date timestamp with time zone;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS linked_investment_id uuid REFERENCES investments(id) ON DELETE SET NULL;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS penalty_config text;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS promo_rate numeric DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS promo_months integer DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS base_rate numeric DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS margin_rate numeric DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS extra_payment numeric DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS offset_threshold numeric DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS periods jsonb;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Yêu cầu PostgREST nạp lại schema cache (nếu không, lỗi schema cache vẫn còn).
NOTIFY pgrst, 'reload schema';
