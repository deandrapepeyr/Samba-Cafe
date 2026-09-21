CREATE TABLE IF NOT EXISTS daily_summaries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  date date UNIQUE NOT NULL,
  total_omzet numeric DEFAULT 0,
  total_qris numeric DEFAULT 0,
  total_cash numeric DEFAULT 0,
  samba_qris numeric DEFAULT 0,
  samba_cash numeric DEFAULT 0,
  titipan_qris numeric DEFAULT 0,
  titipan_cash numeric DEFAULT 0,
  total_transactions int DEFAULT 0,
  total_items int DEFAULT 0,
  total_profit numeric DEFAULT 0,
  qris_count int DEFAULT 0,
  cash_count int DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since the app uses anon key)
CREATE POLICY "Enable read access for all users" ON daily_summaries FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON daily_summaries FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON daily_summaries FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON daily_summaries FOR DELETE USING (true);
