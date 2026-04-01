-- =============================================
-- SABABA TAXI — Ride Reviews Migration
-- Run this in the Supabase SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS ride_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE UNIQUE NOT NULL,
  driver_rating int NOT NULL CHECK (driver_rating BETWEEN 1 AND 5),
  cleanliness_rating int NOT NULL CHECK (cleanliness_rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ride_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a review (they need the tracking token to reach this page)
CREATE POLICY "reviews_insert_anon" ON ride_reviews FOR INSERT WITH CHECK (true);

-- Admins can read all reviews
CREATE POLICY "reviews_admin_read" ON ride_reviews FOR SELECT USING (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
);
