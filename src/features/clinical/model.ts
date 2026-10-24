import type { ScanAsset } from "../scans/model";
export interface TreatmentConfig {
  category: string;
  duration: number;
  intervalDays: number;
  sessions: number;
  individualPrice: number;
  packagePrice: number;
  validityDays: number;
  machineIds: string[];
  documentation: string;
  consent: string;
}
export interface Decision {
  treatmentId: string;
  area: string;
  sessions: number;
  intervalDays: number;
  duration: number;
  price: number;
  instructions: string;
  consent: string;
}
export interface ConsultationData {
  concern: string;
  duration: string;
  previousTreatments: string;
  expectations: string;
  examination: string;
  assessment: string;
  considerations: string;
  requiredReviews: string;
  previousReactions: string;
  images: ScanAsset[];
  imageConsent?: boolean;
  decision: Decision;
  reviewNote: string;
  reviewedAt?: string;
}
export type PlanStatus =
  | "Draft"
  | "Awaiting Approval"
  | "Approved"
  | "Declined"
  | "Converted to Course";
export interface PlanData {
  consultationId: string;
  treatmentId: string;
  treatmentName: string;
  area: string;
  sessions: number;
  intervalDays: number;
  duration: number;
  doctor: string;
  technician: string;
  pricing: "individual" | "package";
  individualPrice: number;
  packagePrice: number;
  packageSessions: number;
  validityDays: number;
  instructions: string;
  consent: string;
  assessment: string;
  notes: string;
  approvedBy?: string;
  approvedAt?: string;
  declineReason?: string;
  approvalNote?: string;
  courseId?: string;
}
export interface CourseData {
  packageTemplateId?: string;
  packageTerms?: string;
  planId: string;
  consultationId: string;
  treatmentId: string;
  treatmentName: string;
  area: string;
  approvingDoctor: string;
  assignedDoctor?: string;
  technician: string;
  startDate: string;
  intervalDays: number;
  validUntil: string;
  packagePrice: number;
  invoiceId?: string;
  nextRecommendedDate?: string;
  lastCompletedDate?: string;
  instructions: string;
  consent: string;
  statusNote?: string;
  completionConfirmed?: boolean;
  completionConfirmedAt?: string;
  finalReview?: string;
  finalReviewDoctor?: string;
  finalReviewAt?: string;
}
export const canDecide = (role: string) =>
  role === "Clinic Owner" || role === "Doctor";
export const planStatuses: PlanStatus[] = [
  "Draft",
  "Awaiting Approval",
  "Approved",
  "Declined",
  "Converted to Course",
];
export const technicians = ["Aarav Singh", "Neha Rao", "Not assigned"];
export function estimate(
  p: Pick<
    PlanData,
    | "sessions"
    | "pricing"
    | "individualPrice"
    | "packagePrice"
    | "packageSessions"
  >,
) {
  return Math.round(
    p.pricing === "individual"
      ? p.individualPrice * p.sessions
      : (p.packagePrice / p.packageSessions) * p.sessions,
  );
}
export const blankDecision: Decision = {
  treatmentId: "",
  area: "",
  sessions: 1,
  intervalDays: 28,
  duration: 30,
  price: 0,
  instructions: "",
  consent: "",
};
export const blankConsultation: ConsultationData = {
  concern: "",
  duration: "",
  previousTreatments: "",
  expectations: "",
  examination: "",
  assessment: "",
  considerations: "",
  requiredReviews: "",
  previousReactions: "",
  images: [],
  decision: blankDecision,
  reviewNote: "",
};
