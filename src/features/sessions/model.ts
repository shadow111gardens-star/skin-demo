import type { ScanAsset } from "../scans/model";
export const sessionStatuses = [
  "Scheduled",
  "Checked In",
  "In Preparation",
  "In Progress",
  "Awaiting Review",
  "Completed",
  "Cancelled",
  "No-show",
] as const;
export type SessionStatus = (typeof sessionStatuses)[number];
export interface ParameterField {
  id: string;
  label: string;
  unit: string;
  type: "number" | "text";
  required: boolean;
}
export interface DeviceDocumentation {
  fields: ParameterField[];
  source: string;
  configuredBy: string;
  version: number;
}
export interface SessionPolicy {
  requireConsentDocument: boolean;
  requireHistoryReview: boolean;
  requireParameterReview: boolean;
  requireMachineCheck: boolean;
  requirePaidPackage: boolean;
  requireValidPackage: boolean;
}
export const defaultPolicy: SessionPolicy = {
  requireConsentDocument: true,
  requireHistoryReview: true,
  requireParameterReview: true,
  requireMachineCheck: true,
  requirePaidPackage: false,
  requireValidPackage: true,
};
export interface SessionAudit {
  id: string;
  at: string;
  actor: string;
  status: string;
  action: string;
  note: string;
}
export interface SessionData {
  inventoryUsageIds?: string[];
  number: number;
  time: string;
  area: string;
  machineId: string;
  handpiece: string;
  operator: string;
  reviewingDoctor: string;
  room: string;
  consentStatus: "Pending" | "Recorded" | "Declined";
  consentDocumentId: string;
  checks: {
    identity: boolean;
    history: boolean;
    parameters: boolean;
    machine: boolean;
  };
  parameters: Record<string, string>;
  parameterSchema: ParameterField[];
  configurationVersion?: number;
  parameterSource?: string;
  parameterApprovedAt?: string;
  parameterApprovalBy: string;
  parameterApprovalNote: string;
  procedureNotes: string;
  consumables: string;
  tolerance: string;
  response: string;
  reaction: "Not assessed" | "None observed" | "Observed";
  reactionNotes: string;
  escalationNote: string;
  aftercare: string;
  technicianNotes: string;
  doctorReview: string;
  beforeImages: ScanAsset[];
  afterImages: ScanAsset[];
  imageConsent: boolean;
  nextDate: string;
  startedAt?: string;
  completedAt?: string;
  savedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  audit: SessionAudit[];
}
export interface CompletionEntry {
  id: string;
  sessionId: string;
  appointmentId?: string;
  patientId: string;
  courseId?: string;
  sitting: number;
  at: string;
  doctor: string;
  units: number;
  packageBefore: number;
  packageAfter: number;
  chargeAmount: number;
}
export const clinicalActor = (role: string) =>
  role === "Doctor" || role === "Clinic Owner";
export function normalizeStatus(status: string): SessionStatus {
  const x = status.toLowerCase();
  return (
    sessionStatuses.find((s) => s.toLowerCase() === x) ||
    (x === "consent pending"
      ? "In Preparation"
      : x === "confirmed" || x === "rescheduled"
        ? "Scheduled"
        : "Scheduled")
  );
}
export const appointmentStatus = (s: SessionStatus) =>
  ({
    Scheduled: "Confirmed",
    "Checked In": "Checked in",
    "In Preparation": "In preparation",
    "In Progress": "In progress",
    "Awaiting Review": "Awaiting review",
    Completed: "Completed",
    Cancelled: "Cancelled",
    "No-show": "No-show",
  })[s];
