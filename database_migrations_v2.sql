-- ============================================
-- Ritual Studios Booking Database Migration V2
-- Run this AFTER database_migrations.sql
-- ============================================

-- Add payment columns to bookings table
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

-- Create index for payment lookups
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_email ON bookings(customer_email);

-- Allow updating bookings (for payment status and cancellation)
CREATE POLICY "Anyone can update bookings"
  ON bookings FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Insert sample time_slots for each class
-- Hot Pilates slots
INSERT INTO time_slots (class_id, day_of_week, start_time, end_time, instructor_name)
SELECT c.id, day.d, slot.start_t, slot.end_t, slot.instructor
FROM classes c
CROSS JOIN (VALUES (1), (2), (3), (4), (5)) AS day(d)
CROSS JOIN (VALUES
  ('06:00'::TIME, '07:00'::TIME, 'Sarah K.'),
  ('09:00'::TIME, '10:00'::TIME, 'Sarah K.'),
  ('17:30'::TIME, '18:30'::TIME, 'James M.')
) AS slot(start_t, end_t, instructor)
WHERE c.name = 'Hot Pilates'
ON CONFLICT DO NOTHING;

-- Reformer Pilates slots
INSERT INTO time_slots (class_id, day_of_week, start_time, end_time, instructor_name)
SELECT c.id, day.d, slot.start_t, slot.end_t, slot.instructor
FROM classes c
CROSS JOIN (VALUES (1), (2), (3), (4), (5), (6)) AS day(d)
CROSS JOIN (VALUES
  ('07:00'::TIME, '08:00'::TIME, 'Anna W.'),
  ('10:00'::TIME, '11:00'::TIME, 'Anna W.'),
  ('16:00'::TIME, '17:00'::TIME, 'David O.')
) AS slot(start_t, end_t, instructor)
WHERE c.name = 'Reformer Pilates'
ON CONFLICT DO NOTHING;

-- Hot Yoga slots
INSERT INTO time_slots (class_id, day_of_week, start_time, end_time, instructor_name)
SELECT c.id, day.d, slot.start_t, slot.end_t, slot.instructor
FROM classes c
CROSS JOIN (VALUES (1), (3), (5), (6)) AS day(d)
CROSS JOIN (VALUES
  ('06:30'::TIME, '07:30'::TIME, 'Priya N.'),
  ('18:00'::TIME, '19:00'::TIME, 'Priya N.')
) AS slot(start_t, end_t, instructor)
WHERE c.name = 'Hot Yoga'
ON CONFLICT DO NOTHING;


-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration V2 completed successfully!';
    RAISE NOTICE 'Added payment_status and payment_reference to bookings';
    RAISE NOTICE 'Inserted sample time_slots for all classes';
END $$;
