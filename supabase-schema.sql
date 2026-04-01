-- =============================================
-- SABABA TAXI - Supabase Schema
-- Run this in the Supabase SQL Editor
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================
-- TABLES
-- =============================================

-- Admins (whitelist of admin user IDs)
create table admins (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  created_at timestamptz default now()
);

-- Drivers profile
create table drivers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  full_name text not null,
  phone text not null,
  vehicle_type text not null default 'regular', -- regular, minivan, luxury
  subscription_active boolean default false,
  subscription_expires_at timestamptz,
  credits numeric default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Price table (city → Ben Gurion)
create table price_table (
  id uuid primary key default uuid_generate_v4(),
  city_name text unique not null,
  base_price numeric not null,
  region text -- north, center, south, jerusalem
);

-- Commission tiers (configurable by admin)
create table commission_tiers (
  id uuid primary key default uuid_generate_v4(),
  min_price numeric not null,
  max_price numeric, -- null = no upper limit
  commission_amount numeric not null,
  vehicle_type text default 'all'
);

-- Bookings
create table bookings (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),

  -- Customer info
  customer_name text not null,
  customer_phone text not null,
  customer_email text,

  -- Pickup
  pickup_city text not null,
  pickup_street text not null,
  pickup_house_number text not null,

  -- Destination
  destination text not null default 'נמל תעופה בן גוריון',

  -- Travel details
  travel_date date not null,
  travel_time time not null,
  passengers int not null default 1,
  large_luggage int not null default 0,
  trolley int not null default 0,

  -- Return trip
  return_trip boolean default false,
  return_address text,
  return_flight_number text,
  return_date date,
  return_time time,

  -- Extras (jsonb flags)
  extras jsonb default '{}',
  -- keys: additional_stop, nearby_city_stop, child_under4, safety_seat, ski_equipment, bike_rack, bit_payment

  special_requests text,

  -- Payment
  payment_method text check (payment_method in ('cash', 'bit')) not null default 'cash',

  -- Pricing
  price numeric not null,

  -- Status flow: pending → approved → claimed → completed | rejected | cancelled
  status text check (status in ('pending','approved','rejected','claimed','completed','cancelled')) not null default 'pending',

  -- Driver assignment
  driver_id uuid references drivers(id),

  admin_notes text,

  -- Live ride tracking
  tracking_token uuid default gen_random_uuid() unique,
  ride_status text check (ride_status in ('en_route','arrived','onboard','done')) default null
);

-- Credit transactions
create table credit_transactions (
  id uuid primary key default uuid_generate_v4(),
  driver_id uuid references drivers(id) on delete cascade not null,
  amount numeric not null, -- positive = credit added, negative = deducted
  type text check (type in ('admin_load','ride_commission')) not null,
  booking_id uuid references bookings(id),
  admin_id uuid references auth.users(id),
  notes text,
  created_at timestamptz default now()
);

-- =============================================
-- INITIAL DATA
-- =============================================

-- Commission tiers: 0-99₪=0, 100-299₪=20, 300-399₪=30, +10 per 100₪
insert into commission_tiers (min_price, max_price, commission_amount, vehicle_type) values
  (0,    99,   0,  'all'),
  (100,  299,  20, 'all'),
  (300,  399,  30, 'all'),
  (400,  499,  40, 'all'),
  (500,  599,  50, 'all'),
  (600,  699,  60, 'all'),
  (700,  799,  70, 'all'),
  (800,  899,  80, 'all'),
  (900,  999,  90, 'all'),
  (1000, null, 100,'all');

-- Price table (city → Ben Gurion Airport, one-way)
insert into price_table (city_name, base_price, region) values
  -- Center
  ('תל אביב', 145, 'center'),
  ('רמת גן', 145, 'center'),
  ('גבעתיים', 145, 'center'),
  ('בני ברק', 145, 'center'),
  ('פתח תקווה', 120, 'center'),
  ('ראשון לציון', 120, 'center'),
  ('רחובות', 120, 'center'),
  ('נס ציונה', 120, 'center'),
  ('לוד', 100, 'center'),
  ('רמלה', 100, 'center'),
  ('שוהם', 100, 'center'),
  ('יהוד', 90, 'center'),
  ('קריית אונו', 110, 'center'),
  ('אור יהודה', 100, 'center'),
  ('אזור', 100, 'center'),
  ('בת ים', 140, 'center'),
  ('חולון', 135, 'center'),
  ('הרצליה', 155, 'center'),
  ('רעננה', 155, 'center'),
  ('כפר סבא', 155, 'center'),
  ('הוד השרון', 150, 'center'),
  ('נתניה', 175, 'center'),
  ('ראש העין', 130, 'center'),
  ('אלעד', 125, 'center'),
  ('מודיעין', 130, 'center'),
  ('מודיעין עילית', 130, 'center'),
  ('רמת השרון', 150, 'center'),
  ('כפר יונה', 155, 'center'),
  ('אור עקיבא', 195, 'center'),
  ('טייבה', 145, 'center'),
  ('קלנסווה', 145, 'center'),
  ('טירה', 145, 'center'),
  -- Sharon / North Center
  ('חדרה', 200, 'sharon'),
  ('זכרון יעקב', 220, 'sharon'),
  ('פרדס חנה', 210, 'sharon'),
  ('בנימינה', 210, 'sharon'),
  ('עמק חפר', 200, 'sharon'),
  -- Jerusalem area
  ('ירושלים', 240, 'jerusalem'),
  ('בית שמש', 200, 'jerusalem'),
  ('מעלה אדומים', 260, 'jerusalem'),
  ('גבעת זאב', 250, 'jerusalem'),
  ('ביתר עילית', 220, 'jerusalem'),
  ('אפרת', 260, 'jerusalem'),
  -- South
  ('באר שבע', 340, 'south'),
  ('אשדוד', 180, 'south'),
  ('אשקלון', 210, 'south'),
  ('קריית גת', 220, 'south'),
  ('קריית מלאכי', 230, 'south'),
  ('גדרה', 160, 'south'),
  ('יבנה', 150, 'south'),
  ('נתיבות', 280, 'south'),
  ('שדרות', 270, 'south'),
  ('אילת', 800, 'south'),
  -- North
  ('חיפה', 400, 'north'),
  ('קריית ים', 400, 'north'),
  ('קריית ביאליק', 390, 'north'),
  ('קריית מוצקין', 390, 'north'),
  ('קריית אתא', 395, 'north'),
  ('נשר', 400, 'north'),
  ('טירת כרמל', 390, 'north'),
  ('עכו', 440, 'north'),
  ('נהריה', 460, 'north'),
  ('כרמיאל', 420, 'north'),
  ('נצרת', 400, 'north'),
  ('נצרת עילית', 400, 'north'),
  ('עפולה', 380, 'north'),
  ('בית שאן', 420, 'north'),
  ('טבריה', 430, 'north'),
  ('צפת', 470, 'north'),
  ('קצרין', 500, 'north'),
  ('יוקנעם', 380, 'north'),
  ('כפר יסיף', 440, 'north'),
  ('מגדל העמק', 380, 'north'),
  -- West Bank settlements (common routes)
  ('אריאל', 160, 'center'),
  ('אלפי מנשה', 165, 'center'),
  ('עמנואל', 155, 'center'),
  ('קדומים', 165, 'center');

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

alter table admins enable row level security;
alter table drivers enable row level security;
alter table bookings enable row level security;
alter table credit_transactions enable row level security;
alter table price_table enable row level security;
alter table commission_tiers enable row level security;

-- Helper: check if current user is admin
create or replace function is_admin()
returns boolean language sql security definer as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;

-- Helper: get driver id for current user
create or replace function get_driver_id()
returns uuid language sql security definer as $$
  select id from drivers where user_id = auth.uid()
$$;

-- price_table: public read
create policy "price_table_public_read" on price_table for select using (true);

-- commission_tiers: admin only
create policy "commission_tiers_admin" on commission_tiers for all using (is_admin());
create policy "commission_tiers_driver_read" on commission_tiers for select using (
  exists (select 1 from drivers where user_id = auth.uid() and is_active = true)
);

-- bookings: customers can insert (anon), drivers see approved+, admins see all
create policy "bookings_insert_anon" on bookings for insert with check (true);
create policy "bookings_admin_all" on bookings for all using (is_admin());
create policy "bookings_driver_read_approved" on bookings for select using (
  status in ('approved') and
  exists (select 1 from drivers where user_id = auth.uid() and subscription_active = true and is_active = true)
);
create policy "bookings_driver_read_own" on bookings for select using (
  driver_id = get_driver_id()
);

-- drivers: admin full access, driver reads own
create policy "drivers_admin_all" on drivers for all using (is_admin());
create policy "drivers_read_own" on drivers for select using (user_id = auth.uid());

-- credit_transactions: admin full, driver reads own
create policy "credits_admin_all" on credit_transactions for all using (is_admin());
create policy "credits_driver_read_own" on credit_transactions for select using (
  driver_id = get_driver_id()
);

-- admins: admin only
create policy "admins_admin_all" on admins for all using (is_admin());

-- =============================================
-- ATOMIC RESERVE RIDE RPC
-- =============================================

create or replace function reserve_ride(p_booking_id uuid, p_driver_id uuid)
returns jsonb
language plpgsql security definer as $$
declare
  v_booking bookings%rowtype;
  v_driver drivers%rowtype;
  v_commission numeric;
  v_tier commission_tiers%rowtype;
begin
  -- Lock the booking row
  select * into v_booking from bookings
  where id = p_booking_id
  for update;

  -- Check booking is still available
  if v_booking.status != 'approved' then
    return jsonb_build_object('success', false, 'error', 'הנסיעה כבר לא זמינה');
  end if;

  -- Get driver
  select * into v_driver from drivers where id = p_driver_id;

  if not v_driver.subscription_active then
    return jsonb_build_object('success', false, 'error', 'המנוי שלך אינו פעיל');
  end if;

  -- Calculate commission
  select * into v_tier from commission_tiers
  where v_booking.price >= min_price
    and (max_price is null or v_booking.price <= max_price)
    and (vehicle_type = 'all' or vehicle_type = v_driver.vehicle_type)
  order by min_price desc
  limit 1;

  v_commission := coalesce(v_tier.commission_amount, 0);

  -- Check driver has enough credits
  if v_driver.credits < v_commission then
    return jsonb_build_object('success', false, 'error', 'אין מספיק קרדיט לשריון הנסיעה');
  end if;

  -- Claim the booking
  update bookings set
    status = 'claimed',
    driver_id = p_driver_id
  where id = p_booking_id;

  -- Deduct credits
  update drivers set
    credits = credits - v_commission
  where id = p_driver_id;

  -- Record transaction
  if v_commission > 0 then
    insert into credit_transactions (driver_id, amount, type, booking_id, notes)
    values (p_driver_id, -v_commission, 'ride_commission', p_booking_id,
            'עמלה על נסיעה ל' || v_booking.pickup_city);
  end if;

  return jsonb_build_object('success', true, 'commission', v_commission);
end;
$$;

-- =============================================
-- ADMIN LOAD CREDITS RPC
-- =============================================

create or replace function admin_load_credits(p_driver_id uuid, p_amount numeric, p_notes text default null)
returns jsonb
language plpgsql security definer as $$
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'error', 'אין הרשאה');
  end if;

  update drivers set credits = credits + p_amount where id = p_driver_id;

  insert into credit_transactions (driver_id, amount, type, admin_id, notes)
  values (p_driver_id, p_amount, 'admin_load', auth.uid(), coalesce(p_notes, 'טעינת קרדיט ידנית'));

  return jsonb_build_object('success', true);
end;
$$;

-- =============================================
-- REALTIME
-- =============================================

-- Enable realtime for bookings table (drivers get live updates)
alter publication supabase_realtime add table bookings;
