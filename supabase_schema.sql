-- SQL SCHEMA FOR FINANCETRACKER (Run this in the Supabase SQL Editor)

-- 1. Profiles Table (Auto created on Auth)
create table profiles (
  id uuid references auth.users not null primary key,
  display_name text,
  currency text default 'VND',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table profiles enable row level security;
create policy "Users can view own profile." on profiles for select using (auth.uid() = id);
create policy "Users can update own profile." on profiles for update using (auth.uid() = id);

-- Trigger to automatically create profile record when user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Accounts Table
create table accounts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  type text not null check (type in ('Ví/Tiền mặt', 'Ngân hàng', 'Ví điện tử', 'Thẻ tín dụng', 'Khoản nợ', 'Phải thu')),
  sub_type text not null check (sub_type in ('payment', 'savings', 'debt')),
  balance numeric default 0 not null,
  currency text default 'VND',
  icon text default 'Wallet',
  color_hex text default '#3B82F6',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table accounts enable row level security;
create policy "Users can view own accounts." on accounts for select using (auth.uid() = user_id);
create policy "Users can insert own accounts." on accounts for insert with check (auth.uid() = user_id);
create policy "Users can update own accounts." on accounts for update using (auth.uid() = user_id);
create policy "Users can delete own accounts." on accounts for delete using (auth.uid() = user_id);

-- 3. Categories Table
create table categories (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  type text not null check (type in ('income', 'expense', 'transfer')),
  icon text,
  color_hex text,
  is_default boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table categories enable row level security;
create policy "Users can view own categories." on categories for select using (auth.uid() = user_id);
create policy "Users can insert own categories." on categories for insert with check (auth.uid() = user_id);
create policy "Users can update own categories." on categories for update using (auth.uid() = user_id);
create policy "Users can delete own categories." on categories for delete using (auth.uid() = user_id);
