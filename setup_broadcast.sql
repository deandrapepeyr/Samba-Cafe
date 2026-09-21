-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since the app uses anon key)
CREATE POLICY "Enable read access for all users" ON settings FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON settings FOR UPDATE USING (true);

-- Enable realtime for settings table
begin;
  -- remove the publication if it already exists
  drop publication if exists supabase_realtime;
  -- re-create it
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table settings;

-- Insert default broadcast message
INSERT INTO settings (key, value) VALUES ('broadcast_message', 'Selamat Datang di Samba Cafe! Semangat puasanya :)') ON CONFLICT (key) DO NOTHING;
