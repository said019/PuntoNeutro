export interface User {
  id: string;
  email: string;
  phone: string;
  display_name: string;
  full_name?: string;
  photo_url: string | null;
  avatar_url?: string | null;
  role: "client" | "instructor" | "admin" | "super_admin" | "reception" | "coach";
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  health_notes: string | null;
  accepts_communications: boolean;
  date_of_birth: string | null;
  receive_reminders: boolean;
  receive_promotions: boolean;
  receive_weekly_summary: boolean;
  created_at: string;
  updated_at: string;
  is_instructor?: boolean;
  instructor_id?: string;
  coach_number?: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  displayName: string;
  phone: string;
  acceptsTerms: boolean;
  acceptsCommunications: boolean;
}

export interface UpdateProfileData {
  displayName?: string;
  phone?: string;
  dateOfBirth?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  healthNotes?: string;
  receiveReminders?: boolean;
  receivePromotions?: boolean;
  receiveWeeklySummary?: boolean;
}
