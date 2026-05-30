-- SQL SCHEMA FOR FINANCETRACKER (Run this in the Supabase SQL Editor)
-- WARNING: This will drop existing tables to recreate a clean state as requested.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables/triggers/functions to ensure clean state
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TRIGGER IF EXISTS on_transaction_modified ON transactions;
DROP FUNCTION IF EXISTS process_transaction();

DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS goals CASCADE;
DROP TABLE IF EXISTS savings CASCADE;
DROP TABLE IF EXISTS investments CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 1. Profiles Table (Auto created on Auth)
CREATE TABLE profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  display_name text,
  currency text DEFAULT 'VND',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile." ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger to automatically create profile record when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'display_name', new.email));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. Accounts Table
CREATE TABLE accounts (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type text NOT NULL, -- 'Ví/Tiền mặt', 'Ngân hàng', 'Ví điện tử', 'Thẻ tín dụng', 'Khoản nợ', 'Phải thu'
  sub_type text NOT NULL, -- 'payment', 'savings', 'debt', 'receivable'
  balance numeric DEFAULT 0 NOT NULL,
  currency text DEFAULT 'VND',
  icon text DEFAULT 'Wallet',
  color_hex text DEFAULT '#3B82F6',
  is_default boolean DEFAULT false,
  include_in_net_worth boolean DEFAULT true,
  status text DEFAULT 'active',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own accounts." ON accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts." ON accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts." ON accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts." ON accounts FOR DELETE USING (auth.uid() = user_id);

-- 3. Categories Table
CREATE TABLE categories (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  icon text,
  color_hex text,
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  is_default boolean DEFAULT false,
  is_ui_default boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own categories." ON categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories." ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories." ON categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories." ON categories FOR DELETE USING (auth.uid() = user_id);

-- 4. Transactions Table
CREATE TABLE transactions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  to_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL, -- Only used for 'transfer'
  amount numeric NOT NULL CHECK (amount > 0),
  type text NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  date timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  note text,
  tags text, -- Stored as comma-separated tags or JSON
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions." ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions." ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions." ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions." ON transactions FOR DELETE USING (auth.uid() = user_id);

-- 5. Loans Table
CREATE TABLE loans (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  total_amount numeric NOT NULL CHECK (total_amount > 0),
  interest_rate numeric DEFAULT 0 NOT NULL,
  term_months integer NOT NULL,
  start_date timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  type text NOT NULL, -- 'borrow' (đi vay) hoặc 'lend' (cho vay)
  status text DEFAULT 'active', -- 'active', 'settled'
  minimum_payment numeric DEFAULT 0,
  payment_date integer, -- day of month (e.g. 15)
  interest_type text DEFAULT 'compound', -- 'simple', 'compound', etc.
  next_payment_amount numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own loans." ON loans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own loans." ON loans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own loans." ON loans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own loans." ON loans FOR DELETE USING (auth.uid() = user_id);

-- 6. Budgets Table
CREATE TABLE budgets (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  month text, -- Format 'YYYY-MM'
  type text DEFAULT 'monthly',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_user_category_month UNIQUE (user_id, category_id, month)
);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own budgets." ON budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own budgets." ON budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budgets." ON budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budgets." ON budgets FOR DELETE USING (auth.uid() = user_id);

-- 7. Investments Table
CREATE TABLE investments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  symbol text NOT NULL,
  name text NOT NULL,
  type text NOT NULL, -- 'gold', 'crypto', 'stock', 'real_estate', 'other'
  buy_price numeric DEFAULT 0 NOT NULL,
  quantity numeric DEFAULT 0 NOT NULL,
  purchase_date timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  current_price numeric DEFAULT 0 NOT NULL,
  initial_amount numeric DEFAULT 0,
  maturity_date timestamp with time zone,
  interest_rate numeric DEFAULT 0,
  interest_type text,
  auto_renew boolean DEFAULT false,
  status text DEFAULT 'active',
  return_rate numeric DEFAULT 0,
  loan_amount numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own investments." ON investments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own investments." ON investments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own investments." ON investments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own investments." ON investments FOR DELETE USING (auth.uid() = user_id);

-- 8. Savings Table
CREATE TABLE savings (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  principal_amount numeric NOT NULL CHECK (principal_amount > 0),
  interest_rate numeric NOT NULL,
  term_months integer NOT NULL,
  term_unit text DEFAULT 'months',
  start_date timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  maturity_date timestamp with time zone NOT NULL,
  interest_type text,
  auto_renew boolean DEFAULT false,
  status text DEFAULT 'active',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE savings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own savings." ON savings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own savings." ON savings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own savings." ON savings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own savings." ON savings FOR DELETE USING (auth.uid() = user_id);

-- 9. Goals Table
CREATE TABLE goals (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  target_amount numeric NOT NULL CHECK (target_amount > 0),
  current_amount numeric DEFAULT 0 NOT NULL,
  deadline timestamp with time zone,
  icon text DEFAULT '🎯',
  color_hex text DEFAULT '#10B981',
  status text DEFAULT 'active',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own goals." ON goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals." ON goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals." ON goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals." ON goals FOR DELETE USING (auth.uid() = user_id);

-- 10. Settings Table
CREATE TABLE settings (
  key text NOT NULL,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  value text,
  PRIMARY KEY (key, user_id)
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own settings." ON settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings." ON settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings." ON settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own settings." ON settings FOR DELETE USING (auth.uid() = user_id);


-- 11. Trigger/Function to automatically process balance updates on transaction insert/update/delete
CREATE OR REPLACE FUNCTION process_transaction()
RETURNS trigger AS $$
BEGIN
  -- INSERT
  IF TG_OP = 'INSERT' THEN
    IF new.type = 'expense' THEN
      UPDATE accounts SET balance = balance - new.amount WHERE id = new.account_id;
    ELSIF new.type = 'income' THEN
      UPDATE accounts SET balance = balance + new.amount WHERE id = new.account_id;
    ELSIF new.type = 'transfer' THEN
      UPDATE accounts SET balance = balance - new.amount WHERE id = new.account_id;
      IF new.to_account_id IS NOT NULL THEN
        UPDATE accounts SET balance = balance + new.amount WHERE id = new.to_account_id;
      END IF;
    END IF;
    RETURN new;
    
  -- DELETE
  ELSIF TG_OP = 'DELETE' THEN
    IF old.type = 'expense' THEN
      UPDATE accounts SET balance = balance + old.amount WHERE id = old.account_id;
    ELSIF old.type = 'income' THEN
      UPDATE accounts SET balance = balance - old.amount WHERE id = old.account_id;
    ELSIF old.type = 'transfer' THEN
      UPDATE accounts SET balance = balance + old.amount WHERE id = old.account_id;
      IF old.to_account_id IS NOT NULL THEN
        UPDATE accounts SET balance = balance - old.amount WHERE id = old.to_account_id;
      END IF;
    END IF;
    RETURN old;
    
  -- UPDATE
  ELSIF TG_OP = 'UPDATE' THEN
    -- Rollback old transaction values
    IF old.type = 'expense' THEN
      UPDATE accounts SET balance = balance + old.amount WHERE id = old.account_id;
    ELSIF old.type = 'income' THEN
      UPDATE accounts SET balance = balance - old.amount WHERE id = old.account_id;
    ELSIF old.type = 'transfer' THEN
      UPDATE accounts SET balance = balance + old.amount WHERE id = old.account_id;
      IF old.to_account_id IS NOT NULL THEN
        UPDATE accounts SET balance = balance - old.amount WHERE id = old.to_account_id;
      END IF;
    END IF;
    
    -- Apply new transaction values
    IF new.type = 'expense' THEN
      UPDATE accounts SET balance = balance - new.amount WHERE id = new.account_id;
    ELSIF new.type = 'income' THEN
      UPDATE accounts SET balance = balance + new.amount WHERE id = new.account_id;
    ELSIF new.type = 'transfer' THEN
      UPDATE accounts SET balance = balance - new.amount WHERE id = new.account_id;
      IF new.to_account_id IS NOT NULL THEN
        UPDATE accounts SET balance = balance + new.amount WHERE id = new.to_account_id;
      END IF;
    END IF;
    RETURN new;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_transaction_modified
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE PROCEDURE process_transaction();
