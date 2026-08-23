-- MIGRATION V15: Bổ sung cột custom_overrides cho bảng loans
--
-- Cho phép lưu vết các tinh chỉnh tùy biến theo từng kỳ của người dùng:
-- {
--   "5": { "prepay": 20000000, "budget": 15000000, "accumulated": 50000000 }
-- }
--
-- Cách chạy: dán nội dung này vào Supabase Dashboard > SQL Editor và Run.

ALTER TABLE loans ADD COLUMN IF NOT EXISTS custom_overrides jsonb;

-- Yêu cầu PostgREST nạp lại schema cache
NOTIFY pgrst, 'reload schema';
