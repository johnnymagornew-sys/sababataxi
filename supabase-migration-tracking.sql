-- Run this in Supabase Dashboard → SQL Editor
-- Adds ride tracking columns to bookings table

ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS tracking_token UUID DEFAULT gen_random_uuid() UNIQUE;

ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS ride_status TEXT 
  CHECK (ride_status IN ('en_route','arrived','onboard','done')) 
  DEFAULT NULL;

-- Backfill existing rows that don't have a tracking_token yet
UPDATE bookings SET tracking_token = gen_random_uuid() WHERE tracking_token IS NULL;
