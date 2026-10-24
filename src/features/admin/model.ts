import type { Role } from "../../auth";
export interface StaffData {
  role: Role;
  phone: string;
  email: string;
  availability: "Available" | "On leave" | "Unavailable";
  notes: string;
  previousNames: string[];
}
export const notificationCategories = [
  "Due follow-ups",
  "Overdue patients",
  "Upcoming appointments",
  "Expiring packages",
  "Maintenance",
  "Low stock",
] as const;
export type NotificationCategory = (typeof notificationCategories)[number];
export interface MessageTemplate {
  id: string;
  name: string;
  body: string;
  active: boolean;
}
export interface CurrencyPreferences {
  code: "INR";
  locale: "en-IN" | "en-GB";
  display: "symbol" | "code";
  minimumDigits: number;
  maximumDigits: number;
}
export interface AdminSettings {
  profile: {
    address: string;
    phone: string;
    email: string;
    website: string;
    timezone: string;
  };
  currency: CurrencyPreferences;
  defaultAppointmentMinutes: number;
  defaultPackageDays: number;
  reminderTemplates: MessageTemplate[];
  defaultReminderId: string;
  consentTemplates: MessageTemplate[];
  defaultConsentId: string;
  notifications: {
    enabled: Record<NotificationCategory, boolean>;
    appointmentDays: number;
    expiryDays: number;
    maintenanceDays: number;
  };
  integrationEvents: {
    id: string;
    integration: string;
    at: string;
    message: string;
  }[];
}
export interface NotificationState {
  read: Record<string, string>;
  dismissed: Record<string, string>;
}
export const settingSections = [
  "Clinic Profile",
  "Treatments",
  "Treatment Intervals",
  "Session Parameter Schemas",
  "Machines",
  "Rooms",
  "Appointment Durations",
  "Package Validity",
  "Reminder Templates",
  "Consent Templates",
  "Currency",
  "Tax Configuration",
  "Notification Preferences",
] as const;
export type SettingSection = (typeof settingSections)[number];
export function defaultAdminSettings(): AdminSettings {
  return {
    profile: {
      address: "Indiranagar, Bengaluru, Karnataka",
      phone: "9000001111",
      email: "reception@mmverse.example.test",
      website: "https://mmverse.example.test",
      timezone: "Asia/Kolkata",
    },
    currency: {
      code: "INR",
      locale: "en-IN",
      display: "symbol",
      minimumDigits: 0,
      maximumDigits: 2,
    },
    defaultAppointmentMinutes: 45,
    defaultPackageDays: 180,
    reminderTemplates: [
      {
        id: "reminder-routine",
        name: "Routine follow-up",
        body: "Hello {firstName}, this is {clinicName}. Please contact our reception to arrange your next visit{datePhrase}. Thank you.",
        active: true,
      },
      {
        id: "reminder-appointment",
        name: "Appointment reminder",
        body: "Hello {firstName}, this is {clinicName}. Please contact reception if you need help with your visit{datePhrase}. Thank you.",
        active: true,
      },
      {
        id: "reminder-package",
        name: "Package enquiry",
        body: "Hello {firstName}, this is {clinicName}. Please contact reception if you would like to review your account. Thank you.",
        active: true,
      },
    ],
    defaultReminderId: "reminder-routine",
    consentTemplates: [
      {
        id: "consent-treatment",
        name: "Treatment discussion",
        body: "Fictional template: the treating clinician documents the discussion of the proposed procedure, patient-specific risks, alternatives and aftercare. Review and patient consent must be recorded separately.",
        active: true,
      },
      {
        id: "consent-photos",
        name: "Clinical image consent",
        body: "Fictional template: discuss the purpose, storage and permitted use of clinical images. Record the patient choice separately; this template is not signed consent.",
        active: true,
      },
      {
        id: "consent-data",
        name: "Clinic communication",
        body: "Fictional template: record the patient communication preferences and consent choices. Saving a template does not record or imply consent.",
        active: true,
      },
    ],
    defaultConsentId: "consent-treatment",
    notifications: {
      enabled: Object.fromEntries(
        notificationCategories.map((c) => [c, true]),
      ) as Record<NotificationCategory, boolean>,
      appointmentDays: 1,
      expiryDays: 14,
      maintenanceDays: 7,
    },
    integrationEvents: [],
  };
}
