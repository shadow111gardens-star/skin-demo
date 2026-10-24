export interface ContactEvent {
  id: string;
  at: string;
  action: string;
  employee: string;
  note: string;
  outcome: string;
}
export interface FollowupData {
  generated?: boolean;
  reminderDraft?: string;
  assignedTo: string;
  outcome: string;
  nextAction: string;
  category: string;
  contacts: ContactEvent[];
  dateOverridden?: boolean;
  appointmentId?: string;
}
export interface BookingAudit {
  at: string;
  actor: string;
  action: string;
  note: string;
}
export const appointmentStatuses = [
  "Confirmed",
  "Checked in",
  "In preparation",
  "In progress",
  "Awaiting review",
  "Completed",
  "Cancelled",
  "No-show",
  "Waiting list",
];
export const followupTabs = [
  "Due Today",
  "Due Soon",
  "Overdue",
  "Missed Appointment",
  "Post-treatment Review",
  "Reaction Requiring Review",
  "Package Nearing Expiry",
  "Course Completion",
  "Inactive Patient",
] as const;
export type FollowupTab = (typeof followupTabs)[number];
