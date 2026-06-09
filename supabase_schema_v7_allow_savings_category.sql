-- MIGRATION V7: Cho phép danh mục có type = 'savings' (danh mục Chuyển khoản)
--
-- Vấn đề: bảng categories có CHECK (type IN ('income','expense','transfer')) nên khi
-- seedDefaultData() chèn các danh mục chuyển khoản mặc định (type='savings'), Supabase
-- từ chối -> tab "Chuyển khoản" bị trống sau khi xóa toàn bộ dữ liệu.
--
-- Cách chạy: dán toàn bộ nội dung này vào Supabase Dashboard > SQL Editor và Run.

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_type_check;

ALTER TABLE categories
  ADD CONSTRAINT categories_type_check
  CHECK (type IN ('income', 'expense', 'transfer', 'savings'));
