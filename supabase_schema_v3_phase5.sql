-- BẢN CẬP NHẬT: NGÂN SÁCH (BUDGETS) VÀ MỤC TIÊU TIẾT KIỆM (GOALS) --
-- Chạy toàn bộ file này trong Supabase SQL Editor

-- 1. Bảng Ngân sách (Budgets)
-- Lưu ý: Mỗi danh mục chỉ được tạo tối đa 1 ngân sách mặc định (để áp dụng đối chiếu cho hàng tháng)
create table if not exists budgets (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  category_id uuid references categories(id) not null,
  amount numeric not null check (amount > 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, category_id) -- Ràng buộc 1 danh mục = 1 ngân sách
);

alter table budgets enable row level security;
create policy "Users can view own budgets." on budgets for select using (auth.uid() = user_id);
create policy "Users can insert own budgets." on budgets for insert with check (auth.uid() = user_id);
create policy "Users can update own budgets." on budgets for update using (auth.uid() = user_id);
create policy "Users can delete own budgets." on budgets for delete using (auth.uid() = user_id);


-- 2. Bảng Mục tiêu tiết kiệm (Goals)
create table if not exists goals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  target_amount numeric not null check (target_amount > 0),
  current_amount numeric default 0 not null check (current_amount >= 0),
  deadline timestamp with time zone,
  icon text default '🎯',
  color_hex text default '#10B981',
  status text default 'active' check (status in ('active', 'completed')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table goals enable row level security;
create policy "Users can view own goals." on goals for select using (auth.uid() = user_id);
create policy "Users can insert own goals." on goals for insert with check (auth.uid() = user_id);
create policy "Users can update own goals." on goals for update using (auth.uid() = user_id);
create policy "Users can delete own goals." on goals for delete using (auth.uid() = user_id);
