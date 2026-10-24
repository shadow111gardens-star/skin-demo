import { followupRows, followupData, reminderPaused } from "./followupLogic";
export {
  followupRows,
  followupData,
  reminderPaused,
  suggestedDate,
  inFollowupTab,
  reminderText,
} from "./followupLogic";
import {
  DEMO_DATE,
  type Appointment,
  type ClinicState,
  type RecordItem,
} from "../../data";
import { safeDate } from "../../services";
import { ensureSession } from "../sessions/sessionData";
import { rescheduleSession, transitionSession } from "../sessions/services";
import { addActivity } from "../../store";

export {
  bookingErrors,
  alternatives,
  treatmentConfig,
  activeBooking,
} from "./availability";
import { bookingErrors } from "./availability";
export function saveAppointment(
  s: ClinicState,
  a: Appointment,
  actor: string,
  reason: string,
  followupId?: string,
): ClinicState {
  const old = s.appointments.find((v) => v.id === a.id);
  if (
    old &&
    ["Completed", "In progress", "Awaiting review"].includes(old.status)
  )
    throw new Error(
      "Clinical work has started. Open the session workspace; this booking cannot be edited.",
    );
  if (old && old.patientId !== a.patientId)
    throw new Error("The existing appointment patient cannot be changed.");
  if (old && old.courseId !== a.courseId)
    throw new Error(
      "Preserve the existing course link; create a separate booking for another course.",
    );
  if (!old && !["Confirmed", "Waiting list"].includes(a.status))
    throw new Error(
      "New bookings must be confirmed or waiting for allocation.",
    );
  const errors = bookingErrors(s, a);
  if (errors.length) throw new Error(errors.join(" "));
  if (!reason.trim()) throw new Error("Enter a booking or change note.");
  let next = s;
  const linked = s.records["Sittings & Sessions"].find(
    (r) => r.appointmentId === a.id,
  );
  if (
    old &&
    linked?.session &&
    (old.date !== a.date || old.time !== a.time) &&
    a.status !== "Waiting list"
  )
    next = rescheduleSession(
      {
        ...s,
        appointments: s.appointments.map((v) =>
          v.id === a.id
            ? {
                ...v,
                doctor: a.doctor,
                technician: a.technician,
                room: a.room,
                machineId: a.machineId,
                duration: a.duration,
              }
            : v,
        ),
      },
      linked.id,
      a.date,
      a.time,
      reason,
      actor,
    );
  const entry = {
    ...a,
    bookingSource: a.bookingSource || old?.bookingSource || "Clinic desk",
    notes: a.notes || "",
    status:
      a.status === "Waiting list"
        ? "Waiting list"
        : old && ["Cancelled", "No-show", "Waiting list"].includes(old.status)
          ? "Confirmed"
          : a.status,
    audit: [
      ...(next.appointments.find((v) => v.id === a.id)?.audit ||
        old?.audit ||
        []),
      {
        at: new Date().toISOString(),
        actor,
        action: old ? "Booking updated" : "Booking created",
        note: reason,
      },
    ],
  };
  next = {
    ...next,
    appointments: old
      ? next.appointments.map((v) => (v.id === a.id ? entry : v))
      : [...next.appointments, entry],
  };
  if (a.status !== "Waiting list") next = ensureSession(next, a.id).state;
  next = {
    ...next,
    records: {
      ...next.records,
      "Sittings & Sessions": next.records["Sittings & Sessions"].map((r) =>
        r.appointmentId === a.id && r.session
          ? {
              ...r,
              date: a.date,
              status:
                a.status === "Waiting list"
                  ? "Cancelled"
                  : ["Cancelled", "No-show"].includes(r.status)
                    ? "Scheduled"
                    : r.status,
              session: {
                ...r.session,
                time: a.time,
                operator: a.technician || "",
                reviewingDoctor: a.doctor,
                room: a.room || "",
                machineId: a.machineId || "",
                checks: {
                  ...r.session.checks,
                  identity:
                    old &&
                    ["Cancelled", "No-show", "Waiting list"].includes(
                      old.status,
                    )
                      ? false
                      : r.session.checks.identity,
                  history:
                    old &&
                    ["Cancelled", "No-show", "Waiting list"].includes(
                      old.status,
                    )
                      ? false
                      : r.session.checks.history,
                  parameters: false,
                  machine: false,
                },
                parameterApprovalBy: "",
                parameterApprovalNote: "",
                parameterApprovedAt: undefined,
                parameters:
                  r.session.machineId !== a.machineId
                    ? {}
                    : r.session.parameters,
                audit: [
                  {
                    id: crypto.randomUUID(),
                    at: new Date().toISOString(),
                    actor,
                    status: r.status,
                    action: "Booking metadata updated",
                    note: reason,
                  },
                  ...r.session.audit,
                ],
              },
            }
          : r,
      ),
    },
  };
  if (followupId) {
    const f = followupRows(next, DEMO_DATE).find((f) => f.id === followupId);
    if (f)
      next = upsertFollowup(next, {
        ...f,
        appointmentId: a.id,
        followup: {
          ...followupData(f),
          appointmentId: a.id,
          outcome: "Appointment scheduled",
          nextAction: "Attend booked appointment",
        },
      });
  }
  return addActivity(
    next,
    `${entry.id}: ${old ? "appointment updated" : "appointment booked"} (${a.status}); ${reason}`,
    a.patientId,
  );
}
export function appointmentAction(
  s: ClinicState,
  id: string,
  status: "Cancelled" | "No-show",
  reason: string,
  actor: string,
) {
  const a = s.appointments.find((a) => a.id === id);
  if (!a) throw new Error("Appointment not found.");
  if (!reason.trim()) throw new Error("Record a reason.");
  if (a.status === "Waiting list" && status === "No-show")
    throw new Error("A waiting-list entry has no reserved attendance slot.");
  let next = s;
  const r = s.records["Sittings & Sessions"].find(
    (r) => r.appointmentId === id,
  );
  if (r?.session)
    next = transitionSession(
      s,
      r.id,
      status,
      { role: "Receptionist", name: actor },
      reason,
    );
  else if (["Completed", "In progress", "Awaiting review"].includes(a.status))
    throw new Error("Use the clinical session workspace for this status.");
  return addActivity(
    {
      ...next,
      appointments: next.appointments.map((v) =>
        v.id === id
          ? {
              ...v,
              status,
              audit: [
                ...(v.audit || []),
                {
                  at: new Date().toISOString(),
                  actor,
                  action: status,
                  note: reason,
                },
              ],
            }
          : v,
      ),
    },
    `${id}: ${status}; no sitting consumed. ${reason}`,
    a.patientId,
  );
}
export function upsertFollowup(s: ClinicState, r: RecordItem): ClinicState {
  return {
    ...s,
    records: {
      ...s.records,
      "Follow-ups": [
        r,
        ...s.records["Follow-ups"].filter((v) => v.id !== r.id),
      ],
    },
  };
}
export function contactAction(
  s: ClinicState,
  id: string,
  action: string,
  note: string,
  employee: string,
  dueDate?: string,
): ClinicState {
  let r = followupRows(s, DEMO_DATE).find((r) => r.id === id);
  if (!r) throw new Error("Follow-up not found.");
  if (!note.trim())
    throw new Error("Record a concise contact note or outcome.");
  if (action === "Override recommended date" && !dueDate)
    throw new Error("Choose a recommended date.");
  if (dueDate && safeDate(dueDate) !== dueDate)
    throw new Error("Choose a valid next date.");
  if (["Completed", "Declined"].includes(r.status))
    throw new Error("This follow-up is closed.");
  if (action === "Draft WhatsApp Reminder" && reminderPaused(s, r))
    throw new Error("Routine reminders are paused pending clinical review.");
  if (action === "Escalate to Doctor" && !/^Dr\./.test(employee))
    throw new Error("Assign the escalation to a doctor.");
  const d = followupData(r),
    resolved = action === "Mark Resolved",
    declined = action === "Record Declined";
  if (
    resolved &&
    /reaction/i.test(r.followupKind || "") &&
    !/^Dr\./.test(employee)
  )
    throw new Error("A clinician must resolve a reaction review.");
  r = {
    ...r,
    status: resolved
      ? "Completed"
      : declined && !/reaction/i.test(r.followupKind || "")
        ? "Declined"
        : r.status,
    dueDate: dueDate || r.dueDate,
    followupKind:
      action === "Escalate to Doctor"
        ? "Adverse reaction review"
        : r.followupKind,
    followup: {
      ...d,
      assignedTo: employee,
      outcome: resolved ? "Resolved" : declined ? "Declined" : action,
      nextAction:
        declined && /reaction/i.test(r.followupKind || "")
          ? "Clinician review required despite declined contact"
          : resolved || declined
            ? "No routine outreach"
            : action === "Escalate to Doctor"
              ? "Clinician review required"
              : dueDate
                ? "Contact on " + dueDate
                : "Review next action",
      dateOverridden: !!dueDate || d.dateOverridden,
      contacts: [
        {
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          action,
          employee,
          note,
          outcome: action,
        },
        ...d.contacts,
      ],
    },
  };
  return addActivity(
    upsertFollowup(s, r),
    `${r.name}: ${action}. ${note}`,
    r.patientId,
  );
}
