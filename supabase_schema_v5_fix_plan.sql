-- 1. Update Budgets table
-- Add month column for monthly specific budgets
ALTER TABLE IF EXISTS budgets ADD COLUMN IF NOT EXISTS month text;

-- Update unique constraint to allow one budget per category per month (or one default budget if month is null)
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_user_id_category_id_key;
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS unique_user_category_month;
ALTER TABLE budgets ADD CONSTRAINT unique_user_category_month UNIQUE (user_id, category_id, month);

-- 2. Update Investments table
-- Add loan_amount for real estate and other leveraged assets
ALTER TABLE IF EXISTS investments ADD COLUMN IF NOT EXISTS loan_amount numeric default 0;

-- Add purchase_date for growth calculations (CAGR)
ALTER TABLE IF EXISTS investments ADD COLUMN IF NOT EXISTS purchase_date timestamp with time zone default timezone('utc'::text, now());
