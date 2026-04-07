-- BẢN CẬP NHẬT: GIAO DỊCH (TRANSACTIONS) & TRIGGERS --
-- Chạy toàn bộ file này trong Supabase SQL Editor

-- 1. Bảng Triggers/Transactions
create table if not exists transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  account_id uuid references accounts(id) not null,
  category_id uuid references categories(id),
  to_account_id uuid references accounts(id), -- Only used for 'transfer'
  amount numeric not null check (amount > 0), -- Amount is always stored as positive
  type text not null check (type in ('income', 'expense', 'transfer')),
  date timestamp with time zone default timezone('utc'::text, now()) not null,
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table transactions enable row level security;
create policy "Users can view own transactions." on transactions for select using (auth.uid() = user_id);
create policy "Users can insert own transactions." on transactions for insert with check (auth.uid() = user_id);
create policy "Users can update own transactions." on transactions for update using (auth.uid() = user_id);
create policy "Users can delete own transactions." on transactions for delete using (auth.uid() = user_id);

-- 2. Hàm xử lý tự động cập nhật số dư khi thao tác với bảng transactions
create or replace function process_transaction()
returns trigger as $$
begin
  -- KHI THÊM GIAO DỊCH MỚI (INSERT)
  if TG_OP = 'INSERT' then
    if new.type = 'expense' then
      update accounts set balance = balance - new.amount where id = new.account_id;
    elsif new.type = 'income' then
      update accounts set balance = balance + new.amount where id = new.account_id;
    elsif new.type = 'transfer' then
      update accounts set balance = balance - new.amount where id = new.account_id;
      update accounts set balance = balance + new.amount where id = new.to_account_id;
    end if;
    return new;
    
  -- KHI XÓA GIAO DỊCH (DELETE / ROLLBACK)
  elsif TG_OP = 'DELETE' then
    if old.type = 'expense' then
      update accounts set balance = balance + old.amount where id = old.account_id;
    elsif old.type = 'income' then
      update accounts set balance = balance - old.amount where id = old.account_id;
    elsif old.type = 'transfer' then
      update accounts set balance = balance + old.amount where id = old.account_id;
      update accounts set balance = balance - old.amount where id = old.to_account_id;
    end if;
    return old;
    
  -- KHI SỬA GIAO DỊCH (UPDATE)
  elsif TG_OP = 'UPDATE' then
    -- Đầu tiên: Hoàn trả lại số tiền cũ (Rollback)
    if old.type = 'expense' then
      update accounts set balance = balance + old.amount where id = old.account_id;
    elsif old.type = 'income' then
      update accounts set balance = balance - old.amount where id = old.account_id;
    elsif old.type = 'transfer' then
      update accounts set balance = balance + old.amount where id = old.account_id;
      update accounts set balance = balance - old.amount where id = old.to_account_id;
    end if;
    
    -- Sau đó: Áp dụng số tiền mới
    if new.type = 'expense' then
      update accounts set balance = balance - new.amount where id = new.account_id;
    elsif new.type = 'income' then
      update accounts set balance = balance + new.amount where id = new.account_id;
    elsif new.type = 'transfer' then
      update accounts set balance = balance - new.amount where id = new.account_id;
      update accounts set balance = balance + new.amount where id = new.to_account_id;
    end if;
    return new;
  end if;
end;
$$ language plpgsql security definer;

-- 3. Tạo Trigger bám trực tiếp vào bảng transactions
drop trigger if exists on_transaction_modified on transactions;
create trigger on_transaction_modified
  after insert or update or delete on transactions
  for each row execute procedure process_transaction();
