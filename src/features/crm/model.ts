export const leadStages = [
  "New Enquiry",
  "Contacted",
  "Consultation Booked",
  "Consultation Completed",
  "Treatment Proposed",
  "Package Purchased",
  "Follow-up Required",
  "Won",
  "Lost",
] as const;
export type LeadStage = (typeof leadStages)[number];
export interface LeadContact {
  id: string;
  date: string;
  method: string;
  outcome: string;
  employee: string;
  note: string;
}
export interface LeadEvent {
  id: string;
  at: string;
  date: string;
  action: string;
  note: string;
  employee: string;
  stage: LeadStage;
}
export interface LeadData {
  phone: string;
  email: string;
  treatmentId: string;
  source: string;
  assignedTo: string;
  createdDate: string;
  lastContact?: string;
  nextFollowup?: string;
  notes: string;
  contacts: LeadContact[];
  events: LeadEvent[];
  convertedAt?: string;
  appointmentId?: string;
}
