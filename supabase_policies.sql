-- SUPABASE SECURITY RLS CONFIGURATION SQL SCRIPT
-- Execute this script in the SQL Editor of your Supabase Dashboard (https://supabase.com)
-- to enforce secure policies on the tables and storage buckets.

--------------------------------------------------------------------------------
-- 1. Setup Database Columns & Tables
--------------------------------------------------------------------------------

-- Add the 'client_ip' column to the 'appointments' table if it doesn't exist
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS client_ip TEXT;

--------------------------------------------------------------------------------
-- 2. Enforce Row Level Security (RLS) on Tables
--------------------------------------------------------------------------------

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 3. RLS Policies for 'appointments' Table
--------------------------------------------------------------------------------

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow public insert" ON appointments;
DROP POLICY IF EXISTS "Allow authenticated read" ON appointments;
DROP POLICY IF EXISTS "Allow authenticated update" ON appointments;
DROP POLICY IF EXISTS "Allow authenticated delete" ON appointments;

-- POLICY: Allow public users (including anon role) to INSERT callback requests only.
-- Enforces that status is 'pending' (or null) and token_number is null to prevent unauthorized confirmations.
CREATE POLICY "Allow public insert" ON appointments
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (status = 'pending' OR status IS NULL) AND
    (token_number IS NULL)
  );

-- POLICY: Allow logged-in receptionists (authenticated role) to view bookings.
CREATE POLICY "Allow authenticated read" ON appointments
  FOR SELECT
  TO authenticated
  USING (true);

-- POLICY: Allow logged-in receptionists to update bookings (assign tokens, change status).
CREATE POLICY "Allow authenticated update" ON appointments
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- POLICY: Allow logged-in receptionists to delete bookings.
CREATE POLICY "Allow authenticated delete" ON appointments
  FOR DELETE
  TO authenticated
  USING (true);

--------------------------------------------------------------------------------
-- 4. RLS Policies for 'doctors' Table
--------------------------------------------------------------------------------

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow public read" ON doctors;
DROP POLICY IF EXISTS "Allow authenticated insert" ON doctors;
DROP POLICY IF EXISTS "Allow authenticated update" ON doctors;
DROP POLICY IF EXISTS "Allow authenticated delete" ON doctors;

-- POLICY: Allow public users (anon and authenticated) to SELECT doctors (needed for the booking dropdown).
CREATE POLICY "Allow public read" ON doctors
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- POLICY: Allow logged-in staff (authenticated role) to add new doctors.
CREATE POLICY "Allow authenticated insert" ON doctors
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- POLICY: Allow logged-in staff to update doctor details or availability.
CREATE POLICY "Allow authenticated update" ON doctors
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- POLICY: Allow logged-in staff to delete doctors from the registry.
CREATE POLICY "Allow authenticated delete" ON doctors
  FOR DELETE
  TO authenticated
  USING (true);

--------------------------------------------------------------------------------
-- 5. RLS Policies for Supabase Storage Buckets ('assets', 'hero-frames')
-- Ensures image files are read-only public and writable only by authenticated users.
--------------------------------------------------------------------------------

-- Enable Row Level Security on the storage objects table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop any existing storage policies for these buckets to avoid conflicts
DROP POLICY IF EXISTS "Allow public read on assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read on hero-frames" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated management on assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated management on hero-frames" ON storage.objects;

-- POLICY: Allow anyone (public/anon) to read/download objects from the 'assets' bucket.
CREATE POLICY "Allow public read on assets" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'assets');

-- POLICY: Allow anyone (public/anon) to read/download objects from the 'hero-frames' bucket.
CREATE POLICY "Allow public read on hero-frames" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'hero-frames');

-- POLICY: Allow logged-in staff (authenticated role) to upload, update, or delete objects in the 'assets' bucket.
CREATE POLICY "Allow authenticated management on assets" ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'assets')
  WITH CHECK (bucket_id = 'assets');

-- POLICY: Allow logged-in staff (authenticated role) to upload, update, or delete objects in the 'hero-frames' bucket.
CREATE POLICY "Allow authenticated management on hero-frames" ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'hero-frames')
  WITH CHECK (bucket_id = 'hero-frames');
