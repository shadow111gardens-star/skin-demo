import type { Appointment, ClinicState, RecordItem } from "../../data";
import { defaultPolicy, normalizeStatus, type SessionData } from "./model";
export function blankSession(
  s: ClinicState,
  a?: Appointment,
  r?: RecordItem,
): SessionData {
  const c = s.records["Treatment Plans"].find(
    (c) => c.id === (a?.courseId || r?.courseId),
  );
  return {
    number: a?.sitting || r?.totalSittings || 1,
    time: a?.time || "09:00",
    area: c?.course?.area || "",
    machineId: a?.machineId || r?.machineId || "",
    handpiece: "",
    operator: a?.technician || "",
    reviewingDoctor: a?.doctor || r?.doctor || "",
    room: a?.room || "",
    consentStatus: a?.consent ? "Recorded" : "Pending",
    consentDocumentId: "",
    checks: {
      identity: false,
      history: false,
      parameters: false,
      machine: false,
    },
    parameters: {},
    parameterSchema: [],
    parameterApprovalBy: "",
    parameterApprovalNote: "",
    procedureNotes: "",
    consumables: "",
    tolerance: "",
    response: "",
    reaction: "Not assessed",
    reactionNotes: "",
    escalationNote: "",
    aftercare: "",
    technicianNotes: "",
    doctorReview: "",
    beforeImages: [],
    afterImages: [],
    imageConsent: false,
    nextDate: "",
    startedAt:
      a?.status === "In progress"
        ? a.date + "T" + a.time + ":00+05:30"
        : undefined,
    audit: [],
  };
}
export function ensureSession(
  s: ClinicState,
  appointmentId: string,
): { state: ClinicState; record: RecordItem } {
  const a = s.appointments.find((a) => a.id === appointmentId);
  if (!a) throw new Error("Appointment not found.");
  if (a.status === "Waiting list")
    throw new Error(
      "Allocate the waiting-list booking before opening a clinical session.",
    );
  const existing = s.records["Sittings & Sessions"].find(
    (r) => r.appointmentId === a.id,
  );
  if (existing?.session) return { state: s, record: existing };
  const p = s.patients.find((p) => p.id === a.patientId);
  if (!p) throw new Error("Patient record not found.");
  const r: RecordItem = {
    ...existing,
    id: existing?.id || "SESSION-" + a.id,
    name: p.name,
    patientId: p.id,
    appointmentId: a.id,
    courseId: a.courseId,
    date: a.date,
    status: normalizeStatus(a.status),
    detail: a.treatment + " | sitting " + (a.sitting || 1),
    amount: 0,
    session: blankSession(s, a, existing),
  };
  const next = {
    ...s,
    records: {
      ...s.records,
      "Sittings & Sessions": existing
        ? s.records["Sittings & Sessions"].map((v) => (v.id === r.id ? r : v))
        : [r, ...s.records["Sittings & Sessions"]],
    },
  };
  return { state: next, record: r };
}
export function enrichSessionState(s: ClinicState): ClinicState {
  if (s.sessionSchemaVersion === 1) return s;
  s.sessionSchemaVersion = 1;
  s.sessionPolicy = { ...defaultPolicy, ...s.sessionPolicy };
  s.sessionCompletions ||= [];
  for (const a of s.appointments.filter((a) => a.status !== "Waiting list"))
    s = ensureSession(s, a.id).state;
  s.records["Sittings & Sessions"] = s.records["Sittings & Sessions"].map(
    (r) => {
      const status = normalizeStatus(r.status),
        session = r.session || blankSession(s, undefined, r);
      return {
        ...r,
        status,
        session: {
          ...session,
          procedureNotes:
            session.procedureNotes || (status === "Completed" ? r.detail : ""),
          audit: session.audit.length
            ? session.audit
            : [
                {
                  id: "import-" + r.id,
                  at: (r.date || "2026-10-23") + "T09:00:00+05:30",
                  actor: "Demo migration",
                  status,
                  action: "Imported historical record",
                  note: "Fictional source retained. Missing settings have not been inferred.",
                },
              ],
        },
      };
    },
  );
  s.records["Packages & Billing"] = s.records["Packages & Billing"].map((i) => {
    const c = s.records["Treatment Plans"].find((c) => c.id === i.courseId);
    return c
      ? {
          ...i,
          packageSessions: {
            total: c.totalSittings || 0,
            used: c.completedSittings || 0,
            remaining: Math.max(
              0,
              (c.totalSittings || 0) - (c.completedSittings || 0),
            ),
          },
        }
      : i;
  });
  return s;
}
