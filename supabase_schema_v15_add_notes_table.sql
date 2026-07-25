-- MIGRATION V15: Thêm bảng notes (Ghi chú)
--
-- Mục đích: Quản lý ghi chú cá nhân (ghi chú tài chính, ý tưởng cải tiến ứng dụng, việc cần làm...)
-- Các cột:
--   - id: uuid primary key
--   - user_id: người dùng sở hữu
--   - title: tiêu đề ghi chú
--   - content: nội dung ghi chú chi tiết
--   - category: phân loại ghi chú ('Tài chính', 'Ứng dụng'...) - có thể mở rộng tùy chọn
--   - is_completed: trạng thái hoàn thành (true/false)
--   - created_at: thời gian tạo
--   - updated_at: thời gian cập nhật gần nhất
--
-- Cách chạy: Dán vào Supabase Dashboard > SQL Editor và bấm Run.

create table if not exists notes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  content text,
  category text default 'Tài chính',
  is_completed boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table notes enable row level security;
create policy "Users can view own notes." on notes for select using (auth.uid() = user_id);
create policy "Users can insert own notes." on notes for insert with check (auth.uid() = user_id);
create policy "Users can update own notes." on notes for update using (auth.uid() = user_id);
create policy "Users can delete own notes." on notes for delete using (auth.uid() = user_id);

-- Yêu cầu PostgREST nạp lại schema cache
NOTIFY pgrst, 'reload schema';
