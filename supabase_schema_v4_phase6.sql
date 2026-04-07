-- BẢN CẬP NHẬT GIAI ĐOẠN 6: QUẢN LÝ TIẾT KIỆM (SAVINGS) VÀ ĐẦU TƯ (INVESTMENTS) --
-- Chạy toàn bộ file này trong Supabase SQL Editor

-- 1. Bảng Sổ Tiết Kiệm (Savings)
create table if not exists savings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  principal_amount numeric not null check (principal_amount > 0),
  interest_rate numeric not null check (interest_rate >= 0), -- Phần trăm (VD: 5.5 nghĩa là 5.5%/năm)
  term_months integer not null check (term_months > 0), -- Kỳ hạn bao nhiêu tháng
  start_date timestamp with time zone not null default timezone('utc'::text, now()),
  status text default 'active' check (status in ('active', 'settled')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table savings enable row level security;
create policy "Users can view own savings." on savings for select using (auth.uid() = user_id);
create policy "Users can insert own savings." on savings for insert with check (auth.uid() = user_id);
create policy "Users can update own savings." on savings for update using (auth.uid() = user_id);
create policy "Users can delete own savings." on savings for delete using (auth.uid() = user_id);

-- 2. Bảng Danh mục Đầu tư (Investments)
create table if not exists investments (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  type text not null check (type in ('gold', 'crypto', 'stock', 'real_estate', 'other')),
  symbol text not null, -- Mã tài sản (SJC, PNJ, BTC, VCB)
  quantity numeric not null check (quantity > 0), -- Số lượng (có thể là số thập phân, vd 0.5 BTC)
  buy_price numeric not null check (buy_price >= 0), -- Giá mua trung bình CỦA 1 ĐƠN VỊ
  current_price numeric not null check (current_price >= 0), -- Giá cập nhật thủ công hiện tại
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table investments enable row level security;
create policy "Users can view own investments." on investments for select using (auth.uid() = user_id);
create policy "Users can insert own investments." on investments for insert with check (auth.uid() = user_id);
create policy "Users can update own investments." on investments for update using (auth.uid() = user_id);
create policy "Users can delete own investments." on investments for delete using (auth.uid() = user_id);
