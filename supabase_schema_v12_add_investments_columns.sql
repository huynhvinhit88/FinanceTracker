-- MIGRATION V12: Bổ sung các cột còn thiếu cho bảng investments
--
-- Vấn đề: database được tạo từ schema cũ (v4) — bảng investments chỉ có
--   id, user_id, type, symbol, quantity, buy_price, current_price, created_at
-- Nhưng app (AddInvestmentSheet.jsx) ghi thêm name, loan_amount, purchase_date...
-- nên PostgREST báo lỗi:
--   Could not find the 'name' column of 'investments' in the schema cache
--
-- => Thêm đầy đủ các cột theo schema v6. Dùng IF NOT EXISTS nên an toàn nếu
--    một số cột đã tồn tại; KHÔNG làm mất dữ liệu.
--
-- Cách chạy: dán toàn bộ nội dung này vào Supabase Dashboard > SQL Editor và Run.

ALTER TABLE investments ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS purchase_date timestamp with time zone DEFAULT timezone('utc'::text, now());
ALTER TABLE investments ADD COLUMN IF NOT EXISTS initial_amount numeric DEFAULT 0;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS maturity_date timestamp with time zone;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS interest_rate numeric DEFAULT 0;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS interest_type text;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS auto_renew boolean DEFAULT false;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE investments ADD COLUMN IF NOT EXISTS return_rate numeric DEFAULT 0;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS loan_amount numeric DEFAULT 0;

-- Yêu cầu PostgREST nạp lại schema cache (nếu không, lỗi schema cache vẫn còn).
NOTIFY pgrst, 'reload schema';
