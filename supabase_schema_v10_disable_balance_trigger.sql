-- MIGRATION V10: Tắt trigger tự cập nhật số dư ở phía DB
--
-- Vấn đề: schema v6 tạo trigger `on_transaction_modified` chạy hàm `process_transaction()`
-- để tự cộng/trừ accounts.balance mỗi khi transactions thay đổi (INSERT/UPDATE/DELETE).
-- NHƯNG ứng dụng đã tự cập nhật số dư ở phía client (`updateAccountBalances` trong
-- AddTransactionSheet/EditTransactionSheet). Nếu trigger còn bật, số dư bị CỘNG ĐÔI.
-- Ngoài ra trigger SQL không đảo dấu cho ví Nợ (`sub_type='debt'`) như client, nên càng sai.
--
-- => Số dư PHẢI do client xử lý (xem business_logic.md). Gỡ trigger + hàm khỏi DB.
--
-- Cách chạy: dán toàn bộ nội dung này vào Supabase Dashboard > SQL Editor và Run.
-- An toàn, KHÔNG làm mất dữ liệu (chỉ gỡ trigger/function).

DROP TRIGGER IF EXISTS on_transaction_modified ON transactions;
DROP FUNCTION IF EXISTS process_transaction();

-- Yêu cầu PostgREST nạp lại schema cache.
NOTIFY pgrst, 'reload schema';
