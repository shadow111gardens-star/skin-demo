import type { SessionData } from "./model";
import { resetState, type ClinicState } from "../../data";
import { ensureSession } from "./sessionData";
import {
  configureDevice,
  recordConsent,
  saveSessionDraft,
  transitionSession,
} from "./services";
export const clinician = { role: "Doctor", name: "Dr. Mehta" };
export function sessionRecord(s: ClinicState, appointmentId = "APT-206") {
  return s.records["Sittings & Sessions"].find(
    (r) => r.appointmentId === appointmentId,
  )!;
}
// Explicit test inputs only: no product setting or hardware specification is seeded.
export function preparedSession(
  source = resetState(),
  appointmentId = "APT-206",
) {
  let s = ensureSession(source, appointmentId).state;
  let r = sessionRecord(s, appointmentId);
  if (r.session!.machineId)
    s = configureDevice(
      s,
      r.session!.machineId,
      {
        fields: [
          {
            id: "test-energy",
            label: "Test energy entry",
            unit: "test units",
            type: "number",
            required: true,
          },
        ],
        source: "Fictional test documentation; not hardware specifications",
        configuredBy: "Dr. Mehta",
        version: 0,
      },
      "Doctor",
    );
  s = recordConsent(s, r, "Dr. Mehta", "Fictional test consent reviewed");
  r = sessionRecord(s, appointmentId);
  const data: SessionData = {
    ...r.session!,
    area: r.session!.area || "Test area",
    handpiece: "Clinic-entered test applicator",
    operator: r.session!.operator || "Neha Shah",
    reviewingDoctor: "Dr. Mehta",
    room: r.session!.room || "Room 03",
    consentStatus: "Recorded" as const,
    consentDocumentId: "consent-" + r.id,
    checks: { identity: true, history: true, parameters: true, machine: true },
    parameters: r.session!.machineId ? { "test-energy": "12" } : {},
    parameterApprovalBy: "Dr. Mehta",
    parameterApprovalNote: "Explicit test approval only",
    parameterApprovedAt: new Date().toISOString(),
  };
  s = saveSessionDraft(s, r.id, data, "Dr. Mehta");
  return s;
}
export function reviewReady(source = resetState(), appointmentId = "APT-206") {
  let s = preparedSession(source, appointmentId),
    r = sessionRecord(s, appointmentId);
  for (const status of [
    "Checked In",
    "In Preparation",
    "In Progress",
  ] as const) {
    r = sessionRecord(s, appointmentId);
    if (
      (status === "Checked In" && r.status === "Scheduled") ||
      (status === "In Preparation" && r.status === "Checked In") ||
      (status === "In Progress" && r.status === "In Preparation")
    )
      s = transitionSession(s, r.id, status, clinician);
  }
  r = sessionRecord(s, appointmentId);
  s = saveSessionDraft(
    s,
    r.id,
    {
      ...r.session!,
      procedureNotes: "Procedure documented by operator",
      consumables: "Recorded consumable",
      tolerance: "Patient report documented",
      response: "Observed response documented",
      reaction: "None observed",
      aftercare: "Clinician-entered aftercare",
      doctorReview: "Clinical record reviewed",
      nextDate: "2026-11-20",
    },
    "Dr. Mehta",
  );
  return transitionSession(s, r.id, "Awaiting Review", clinician);
}
