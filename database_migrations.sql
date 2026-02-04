-- ============================================
-- Ritual Studios Booking Database Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create classes table (class types: Hot Yoga, Hot Pilates, Reformer, Cold Plunge)
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER DEFAULT 60,
  max_capacity INTEGER,
  price_single INTEGER, -- Price in KES for single class
  price_intro INTEGER, -- Price in KES for intro package
  price_monthly INTEGER, -- Price in KES for monthly package
  price_3month INTEGER, -- Price in KES for 3-month package
  price_pack_5 INTEGER, -- Price in KES for 5-pack
  price_pack_8 INTEGER, -- Price in KES for 8-pack
  price_pack_10 INTEGER, -- Price in KES for 10-pack
  price_pack_12 INTEGER, -- Price in KES for 12-pack
  price_member INTEGER, -- Price in KES for members (Cold Plunge)
  price_non_member INTEGER, -- Price in KES for non-members (Cold Plunge)
  price_bundle_fire_ice INTEGER, -- Price for Fire and Ice bundle
  price_bundle_pilates_plunge INTEGER, -- Price for Pilates and Plunge bundle
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create time_slots table (available time slots for classes)
CREATE TABLE IF NOT EXISTS time_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL, -- 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  instructor_name TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(class_id, day_of_week, start_time)
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Optional: allows bookings without auth
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  time_slot_id UUID REFERENCES time_slots(id) ON DELETE SET NULL,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  package_type TEXT, -- 'single', 'intro', 'monthly', '3month', 'pack_5', 'pack_8', 'pack_10', 'pack_12', 'member', 'non_member', 'bundle_fire_ice', 'bundle_pilates_plunge'
  price_paid INTEGER NOT NULL, -- Price in KES
  status TEXT DEFAULT 'confirmed', -- 'confirmed', 'cancelled', 'completed', 'no_show'
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  special_requests TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_packages table (track user's package purchases)
CREATE TABLE IF NOT EXISTS user_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  package_type TEXT NOT NULL,
  sessions_total INTEGER NOT NULL, -- Total sessions in package
  sessions_used INTEGER DEFAULT 0, -- Sessions used
  sessions_remaining INTEGER NOT NULL, -- Sessions remaining
  purchase_date DATE NOT NULL,
  expiry_date DATE, -- Optional expiry date
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_class_id ON bookings(class_id);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_time_slots_class_id ON time_slots(class_id);
CREATE INDEX IF NOT EXISTS idx_time_slots_day ON time_slots(day_of_week);
CREATE INDEX IF NOT EXISTS idx_user_packages_user_id ON user_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_user_packages_class_id ON user_packages(class_id);
CREATE INDEX IF NOT EXISTS idx_user_packages_active ON user_packages(active);

-- Enable Row Level Security
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_packages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for classes (public read, admin write)
CREATE POLICY "Anyone can view active classes"
  ON classes FOR SELECT
  USING (active = true);

-- RLS Policies for time_slots (public read, admin write)
CREATE POLICY "Anyone can view active time slots"
  ON time_slots FOR SELECT
  USING (active = true);

-- RLS Policies for bookings (require authentication)
CREATE POLICY "Authenticated users can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their own bookings"
  ON bookings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own bookings"
  ON bookings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can cancel their own bookings"
  ON bookings FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for user_packages (users see their own)
CREATE POLICY "Users can view their own packages"
  ON user_packages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own package details"
  ON user_packages FOR SELECT
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_packages_updated_at BEFORE UPDATE ON user_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial class data - 3 classes only
INSERT INTO classes (name, description, price_single, price_intro, price_monthly, price_3month) VALUES
  ('Hot Pilates', 'Hot Pilates is a fun, challenging, full body, low impact, high intensity workout using pilates principles.', 2000, 5000, 18000, 50000)
ON CONFLICT DO NOTHING;

INSERT INTO classes (name, description, price_single, price_intro, price_pack_5, price_pack_8, price_pack_10, price_pack_12) VALUES
  ('Reformer Pilates', 'Our Reformer class delivers a full-body workout that boosts strength, flexibility, and balance, while also aiding in injury prevention, rehabilitation, and improved posture through precise, controlled movements.', 3000, 5000, 12000, 19500, 23000, 27000)
ON CONFLICT DO NOTHING;

INSERT INTO classes (name, description, price_single) VALUES
  ('Hot Yoga', 'Hot Yoga classes are designed to improve flexibility, detoxify the body, and build strength. In a heated room, you''ll experience deeper stretches and a refreshing release of tension.', 2000)
ON CONFLICT DO NOTHING;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Database migration completed successfully!';
    RAISE NOTICE 'Classes table created with initial data';
    RAISE NOTICE 'Bookings system ready to use';
END $$;
