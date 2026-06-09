-- MIGRATION V9: Thêm cột auto_renew_compound cho bảng savings
--
-- Phục vụ tính năng "tái tục tự động" khi mở sổ tiết kiệm:
--   - auto_renew            (đã có từ v6/v8): bật/tắt tự động tái tục khi đáo hạn.
--   - auto_renew_compound   (MỚI): khi tái tục tự động thì gộp cả lãi vào sổ mới (lãi kép)
--                            hay chỉ tái tục tiền gốc (lãi nhận về tài khoản nguồn).
--
-- Cách chạy: dán toàn bộ nội dung này vào Supabase Dashboard > SQL Editor và Run.
-- An toàn, không mất dữ liệu (ADD COLUMN IF NOT EXISTS).

ALTER TABLE savings ADD COLUMN IF NOT EXISTS auto_renew boolean DEFAULT false;
ALTER TABLE savings ADD COLUMN IF NOT EXISTS auto_renew_compound boolean DEFAULT false;

NOTIFY pgrst, 'reload schema';
