export type BookingStatus = 'pending' | 'approved' | 'rejected' | 'claimed' | 'completed' | 'cancelled'
export type RideStatus = 'en_route' | 'arrived' | 'onboard' | 'done'
export type PaymentMethod = 'cash' | 'bit'
export type VehicleType = 'regular' | 'minivan' | 'luxury'
export type TransactionType = 'admin_load' | 'ride_commission'

export interface BookingExtras {
  additional_stop?: boolean
  nearby_city_stop?: boolean
  child_under4?: boolean
  safety_seat?: boolean
  ski_equipment?: boolean
  bike_rack?: boolean
}

export interface Booking {
  id: string
  created_at: string
  customer_name: string
  customer_phone: string
  customer_email?: string | null
  pickup_city: string
  pickup_street: string
  pickup_house_number: string
  destination: string
  travel_date: string
  travel_time: string
  passengers: number
  large_luggage: number
  trolley: number
  return_trip: boolean
  return_address?: string | null
  return_flight_number?: string | null
  return_date?: string | null
  return_time?: string | null
  extras: BookingExtras
  special_requests?: string | null
  payment_method: PaymentMethod
  price: number
  status: BookingStatus
  driver_id?: string | null
  admin_notes?: string | null
  tracking_token?: string | null
  ride_status?: RideStatus | null
}

export type BookingInsert = Omit<Booking, 'id' | 'created_at'>
export type BookingUpdate = Partial<Omit<Booking, 'id' | 'created_at'>>

export interface Driver {
  id: string
  user_id: string
  full_name: string
  phone: string
  vehicle_type: VehicleType
  vehicle_number?: string | null
  vehicle_model?: string | null
  subscription_active: boolean
  subscription_expires_at?: string | null
  credits: number
  is_active: boolean
  created_at: string
}

export type DriverUpdate = Partial<Omit<Driver, 'id' | 'user_id' | 'created_at'>>

export interface CreditTransaction {
  id: string
  driver_id: string
  amount: number
  type: TransactionType
  booking_id?: string | null
  admin_id?: string | null
  notes?: string | null
  created_at: string
}

export interface PriceTableEntry {
  id: string
  city_name: string
  base_price: number
  region: string
}

export interface CommissionTier {
  id: string
  min_price: number
  max_price?: number | null
  commission_amount: number
  vehicle_type: string
}

// Supabase Database type
export type Database = {
  public: {
    Tables: {
      bookings: {
        Row: Booking
        Insert: BookingInsert
        Update: BookingUpdate
      }
      drivers: {
        Row: Driver
        Insert: Omit<Driver, 'id' | 'created_at'>
        Update: DriverUpdate
      }
      credit_transactions: {
        Row: CreditTransaction
        Insert: Omit<CreditTransaction, 'id' | 'created_at'>
        Update: Partial<CreditTransaction>
      }
      price_table: {
        Row: PriceTableEntry
        Insert: Omit<PriceTableEntry, 'id'>
        Update: Partial<PriceTableEntry>
      }
      commission_tiers: {
        Row: CommissionTier
        Insert: Omit<CommissionTier, 'id'>
        Update: Partial<CommissionTier>
      }
      admins: {
        Row: { id: string; user_id: string; created_at: string }
        Insert: { user_id: string }
        Update: Record<string, never>
      }
    }
    Functions: {
      reserve_ride: {
        Args: { p_booking_id: string; p_driver_id: string }
        Returns: { success: boolean; error?: string; commission?: number }
      }
      admin_load_credits: {
        Args: { p_driver_id: string; p_amount: number; p_notes?: string }
        Returns: { success: boolean; error?: string }
      }
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
    }
  }
}
