import { staffRestriction } from "../admin/access";
import {
  machineRestriction,
  roomRestriction,
  roomFor,
} from "../operations/selectors";
import { bookingErrors } from "../scheduling/availability";
import {
  DEMO_DATE,
  type ClinicState,
  type RecordItem,
  type Appointment,
} from "../../data";
import { bookingConflict, addDays, dayLabel, safeDate } from "../../services";
import {
  clinicalActor,
  appointmentStatus,
  normalizeStatus,
  defaultPolicy,
  type SessionStatus,
  type SessionData,
  type SessionPolicy,
  type DeviceDocumentation,
} from "./model";
import { ensureSession } from "./sessionData";
function replace(s: ClinicState, r: RecordItem): ClinicState {
  return {
    ...s,
    records: {
      ...s.records,
      "Sittings & Sessions": s.records["Sittings & Sessions"].map((v) =>
        v.id === r.id ? r : v,
      ),
    },
  };
}
function audit(
  s: ClinicState,
  r: RecordItem,
  actor: string,
  action: string,
  note = "",
) {
  const at = new Date().toISOString();
  const item = {
    id: crypto.randomUUID(),
    at,
    actor,
    status: r.status,
    action,
    note,
  };
  const next = replace(s, {
    ...r,
    session: { ...r.session!, savedAt: at, audit: [item, ...r.session!.audit] },
  });
  return {
    ...next,
    activity: [
      {
        id: item.id,
        at,
        patientId: r.patientId,
        message: r.name + ": " + action + (note ? " | " + note : ""),
      },
      ...s.activity,
    ].slice(0, 500),
  };
}
export function packageBalance(s: ClinicState, r: RecordItem) {
  const c = s.records["Treatment Plans"].find((c) => c.id === r.courseId);
  return c
    ? {
        total: c.totalSittings || 0,
        used: c.completedSittings || 0,
        remaining: Math.max(
          0,
          (c.totalSittings || 0) - (c.completedSittings || 0),
        ),
      }
    : null;
}
export function parameterFields(s: ClinicState, machineId: string) {
  return (
    s.records["Machines & Equipment"].find((m) => m.id === machineId)
      ?.deviceDocumentation?.fields || []
  );
}
function activePatient(s: ClinicState, r: RecordItem) {
  const p = s.patients.find((p) => p.id === r.patientId);
  if (!p || p.status === "Archived")
    throw new Error("Select a non-archived existing patient.");
  return p;
}
export function startErrors(s: ClinicState, r: RecordItem) {
  const d = r.session!,
    p = activePatient(s, r),
    policy = { ...defaultPolicy, ...s.sessionPolicy },
    errors: string[] = [];
  const c = s.records["Treatment Plans"].find((c) => c.id === r.courseId);
  if (r.courseId && !c)
    errors.push(
      "The linked course no longer exists. Review the patient/course connection.",
    );
  if (c && c.status !== "Active")
    errors.push("The linked course must be active.");
  if (c && packageBalance(s, r)!.remaining < 1)
    errors.push("No package sittings remain.");
  if (
    policy.requireValidPackage &&
    c?.course &&
    c.course.validUntil < (r.date || DEMO_DATE)
  )
    errors.push("The package has expired; clinician review is required.");
  if (
    policy.requirePaidPackage &&
    c &&
    s.records["Packages & Billing"].some(
      (i) => i.courseId === c.id && i.status !== "Paid",
    )
  )
    errors.push("Clinic policy requires a paid package.");
  if (
    !d.area.trim() ||
    !d.operator.trim() ||
    !d.reviewingDoctor ||
    !d.room.trim()
  )
    errors.push("Record treatment area, operator, reviewing doctor and room.");
  if (["not assigned", "unassigned"].includes(d.operator.trim().toLowerCase()))
    errors.push("Assign a treating operator.");
  if (s.records["Rooms & Resources"]?.length && !roomFor(s, d.room))
    errors.push("Choose a registered clinic room.");
  const operatorError = staffRestriction(s, d.operator, "Laser Technician"),
    doctorError = staffRestriction(s, d.reviewingDoctor, "Doctor");
  if (operatorError) errors.push(operatorError);
  if (doctorError) errors.push(doctorError);
  const roomError = roomRestriction(s, d.room);
  if (roomError) errors.push(roomError);
  if (!d.checks.identity) errors.push("Confirm patient identity.");
  if (policy.requireHistoryReview && !d.checks.history)
    errors.push(
      "Review allergies, alerts, previous reactions and clinical history.",
    );
  if (d.consentStatus !== "Recorded")
    errors.push("Relevant consent must be recorded.");
  if (
    policy.requireConsentDocument &&
    !s.records["Clinical Documents"].some(
      (v) =>
        v.id === d.consentDocumentId &&
        v.patientId === r.patientId &&
        (!v.courseId || v.courseId === r.courseId) &&
        ["Signed", "Recorded"].includes(v.status),
    )
  )
    errors.push("Select a recorded consent document for this patient/course.");
  if (
    policy.requireParameterReview &&
    (!d.checks.parameters ||
      !d.parameterApprovalBy.trim() ||
      !d.parameterApprovalNote.trim())
  )
    errors.push("Record clinician parameter/protocol approval and its note.");
  const visit = s.appointments.find((a) => a.id === r.appointmentId);
  const configuredTreatment = s.records["Treatment Catalogue"].find(
    (t) =>
      t.id === c?.course?.treatmentId ||
      (!!visit?.treatment &&
        t.name.toLowerCase() === visit.treatment.toLowerCase()),
  );
  if (configuredTreatment?.treatment?.machineIds.length && !d.machineId)
    errors.push("Select a compatible treatment machine.");
  if (
    visit &&
    (visit.patientId !== r.patientId ||
      visit.courseId !== r.courseId ||
      visit.date !== r.date ||
      visit.time !== d.time)
  )
    errors.push("Appointment, patient and session context must match.");
  if (c && c.patientId !== r.patientId)
    errors.push("Course and patient must match.");
  if (!Number.isInteger(d.number) || d.number < 1)
    errors.push("Record a valid sitting number.");
  if (d.machineId) {
    const machine = s.records["Machines & Equipment"].find(
      (m) => m.id === d.machineId,
    );
    if (!machine) errors.push("Choose an existing machine.");
    const restriction = machineRestriction(s, d.machineId);
    if (restriction) errors.push(restriction);
    if (
      machine &&
      ["Maintenance", "Offline", "Out of service"].includes(machine.status)
    )
      errors.push("This machine is not available for treatment.");
    if (policy.requireMachineCheck && !d.checks.machine)
      errors.push("Confirm the selected machine is ready.");
    if (machine?.deviceDocumentation?.version !== d.configurationVersion)
      errors.push(
        "Device configuration changed. Save and review the current parameters again.",
      );
    const fields = parameterFields(s, d.machineId);
    if (!fields.length)
      errors.push(
        "This device has no configured documentation fields. Ask a clinician to configure units from the device documentation.",
      );
    for (const f of fields) {
      if (f.required && !d.parameters[f.id]?.trim())
        errors.push("Enter " + f.label + " (" + f.unit + ").");
      if (
        d.parameters[f.id] &&
        f.type === "number" &&
        !Number.isFinite(Number(d.parameters[f.id]))
      )
        errors.push(f.label + " must be a valid number.");
    }
    if (!d.handpiece.trim()) errors.push("Record the handpiece/applicator.");
    const t = configuredTreatment;
    if (t?.treatment && !t.treatment.machineIds.includes(d.machineId))
      errors.push(
        "The machine is not listed in this treatment’s clinic configuration. A clinician must review the catalogue configuration.",
      );
  }
  if (p.clinical?.alerts.length && !d.checks.history)
    errors.push("Important clinician-reviewed alerts require acknowledgement.");
  return [...new Set(errors)];
}
export function saveSessionDraft(
  s: ClinicState,
  id: string,
  data: SessionData,
  actor: string,
): ClinicState {
  const r = s.records["Sittings & Sessions"].find((r) => r.id === id);
  if (!r?.session) throw new Error("Session record not found.");
  if (["Completed", "Cancelled", "No-show"].includes(r.status))
    throw new Error("This session is read-only.");
  activePatient(s, r);
  const old = r.session;
  if (data.room !== old.room) {
    const error = roomRestriction(s, data.room);
    if (error) throw new Error(error);
    if (s.records["Rooms & Resources"]?.length && !roomFor(s, data.room))
      throw new Error("Choose a registered clinic room.");
  }
  if (data.machineId && data.machineId !== old.machineId) {
    const error = machineRestriction(s, data.machineId);
    if (error) throw new Error(error);
  }
  const settingsChanged =
    JSON.stringify(old.parameters) !== JSON.stringify(data.parameters) ||
    old.machineId !== data.machineId ||
    old.area !== data.area ||
    old.handpiece !== data.handpiece ||
    old.configurationVersion !==
      s.records["Machines & Equipment"].find((m) => m.id === data.machineId)
        ?.deviceDocumentation?.version;
  const machine = s.records["Machines & Equipment"].find(
    (m) => m.id === data.machineId,
  );
  if (old.reaction === "Observed" && data.reaction !== "Observed")
    throw new Error(
      "Retain the observed reaction in this session; document clinician review rather than removing it.",
    );
  if (
    old.parameterSchema.length > 0 &&
    old.configurationVersion !== machine?.deviceDocumentation?.version &&
    Object.keys(data.parameters).length &&
    data.configurationVersion !== machine?.deviceDocumentation?.version
  )
    throw new Error(
      "Clear prior settings before documenting a changed device configuration.",
    );
  const session: SessionData = {
    ...data,
    audit: old.audit,
    inventoryUsageIds: old.inventoryUsageIds,
    startedAt: old.startedAt,
    completedAt: old.completedAt,
    parameterSchema: parameterFields(s, data.machineId),
    configurationVersion: machine?.deviceDocumentation?.version,
    parameterSource: machine?.deviceDocumentation?.source,
    checks: {
      ...data.checks,
      parameters:
        settingsChanged && data.parameterApprovedAt === old.parameterApprovedAt
          ? false
          : data.checks.parameters,
    },
    parameterApprovalBy:
      settingsChanged && data.parameterApprovedAt === old.parameterApprovedAt
        ? ""
        : data.parameterApprovalBy,
    parameterApprovalNote:
      settingsChanged && data.parameterApprovedAt === old.parameterApprovedAt
        ? ""
        : data.parameterApprovalNote,
  };
  if (
    session.beforeImages.length + session.afterImages.length > 8 ||
    [...session.beforeImages, ...session.afterImages].reduce(
      (n, a) => n + a.size,
      0,
    ) > 2000000
  )
    throw new Error("Use up to 8 images and 2 MB total.");
  if (
    (session.beforeImages.length || session.afterImages.length) &&
    !session.imageConsent
  )
    throw new Error("Confirm fictional image use and recorded image consent.");
  const appointment = s.appointments.find((a) => a.id === r.appointmentId);
  if (
    appointment &&
    (appointment.technician !== session.operator ||
      appointment.doctor !== session.reviewingDoctor ||
      (appointment.machineId || "") !== session.machineId ||
      appointment.room !== session.room)
  ) {
    if (
      bookingConflict(s, {
        ...appointment,
        technician: session.operator,
        doctor: session.reviewingDoctor,
        machineId: session.machineId || undefined,
        room: session.room,
      })
    )
      throw new Error(
        "The selected patient or care resource is already booked at this time.",
      );
  }
  let next = replace(s, { ...r, session });
  next = {
    ...next,
    appointments: next.appointments.map((a) =>
      a.id === r.appointmentId
        ? {
            ...a,
            technician: session.operator,
            doctor: session.reviewingDoctor,
            machineId: session.machineId || undefined,
            room: session.room,
          }
        : a,
    ),
  };
  if (session.reaction === "Observed") {
    if (!session.reactionNotes.trim() || !session.escalationNote.trim())
      throw new Error(
        "Describe the adverse reaction and record escalation to the reviewing clinician.",
      );
    const key = "reaction-" + r.id;
    const followup: RecordItem = {
      id: key,
      name: r.name,
      patientId: r.patientId,
      courseId: r.courseId,
      sessionId: r.id,
      followupKind: "Adverse reaction review",
      date: r.date,
      dueDate: DEMO_DATE,
      status: "Due today",
      amount: 0,
      detail: "Clinician review required: " + session.reactionNotes,
    };
    next = {
      ...next,
      records: {
        ...next.records,
        "Follow-ups": next.records["Follow-ups"].some((f) => f.id === key)
          ? next.records["Follow-ups"].map((f) =>
              f.id === key
                ? {
                    ...followup,
                    status: f.status === "Completed" ? "Due today" : f.status,
                  }
                : f,
            )
          : [followup, ...next.records["Follow-ups"]],
      },
    };
    if (["In Progress", "In Preparation"].includes(r.status)) {
      next = replace(next, { ...r, status: "Awaiting Review", session });
      next = {
        ...next,
        appointments: next.appointments.map((a) =>
          a.id === r.appointmentId ? { ...a, status: "Awaiting review" } : a,
        ),
      };
    }
  }
  return audit(
    next,
    next.records["Sittings & Sessions"].find((v) => v.id === id)!,
    actor,
    session.reaction === "Observed"
      ? "Adverse reaction escalated; clinician review required"
      : "Session draft saved",
  );
}
const nextStates: Record<string, SessionStatus[]> = {
  Scheduled: ["Checked In", "Cancelled", "No-show"],
  "Checked In": ["In Preparation", "Cancelled"],
  "In Preparation": ["In Progress", "Cancelled"],
  "In Progress": ["Awaiting Review"],
  "Awaiting Review": ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
  "No-show": [],
};
export function allowedTransitions(status: string) {
  return nextStates[normalizeStatus(status)] || [];
}
export function transitionSession(
  s: ClinicState,
  id: string,
  target: SessionStatus,
  actor: { role: string; name: string },
  note = "",
): ClinicState {
  const r = s.records["Sittings & Sessions"].find((r) => r.id === id);
  if (!r?.session) throw new Error("Session not found.");
  if (target === "Completed") return completeSession(s, id, actor, note);
  if (!allowedTransitions(r.status).includes(target))
    throw new Error("This lifecycle transition is not permitted.");
  activePatient(s, r);
  if (["Cancelled", "No-show"].includes(target) && !note.trim())
    throw new Error("Record a reason for this status change.");
  if (target === "No-show" && (r.date || DEMO_DATE) > DEMO_DATE)
    throw new Error("A future appointment cannot be marked no-show.");
  if (
    ["In Preparation", "In Progress", "Awaiting Review"].includes(target) &&
    !["Clinic Owner", "Doctor", "Laser Technician"].includes(actor.role)
  )
    throw new Error("Choose a clinical demo role to document the procedure.");
  if (target === "In Progress") {
    if ((r.date || DEMO_DATE) > DEMO_DATE)
      throw new Error("A future sitting cannot be started.");
    const errors = startErrors(s, r);
    if (errors.length) throw new Error(errors.join(" "));
    if (
      s.records["Sittings & Sessions"].some(
        (v) =>
          v.id !== id &&
          v.status === "In Progress" &&
          ((r.session!.machineId &&
            v.session?.machineId === r.session!.machineId) ||
            v.session?.operator === r.session!.operator) &&
          v.date === r.date,
      )
    )
      throw new Error(
        "The machine or operator is already in use by an in-progress sitting.",
      );
  }
  if (
    target === "Awaiting Review" &&
    (!r.session.procedureNotes.trim() ||
      !r.session.tolerance.trim() ||
      !r.session.response.trim() ||
      r.session.reaction === "Not assessed" ||
      !r.session.aftercare.trim())
  )
    throw new Error(
      "Complete procedure notes, patient tolerance, observed response, reaction assessment and aftercare before requesting review.",
    );
  const record = {
    ...r,
    status: target,
    session: {
      ...r.session,
      startedAt:
        target === "In Progress"
          ? new Date().toISOString()
          : r.session.startedAt,
    },
  };
  const next = {
    ...replace(s, record),
    appointments: s.appointments.map((a) =>
      a.id === r.appointmentId
        ? {
            ...a,
            status: appointmentStatus(target),
            audit: [
              ...(a.audit || []),
              {
                at: new Date().toISOString(),
                actor: actor.name,
                action: target,
                note,
              },
            ],
            consent: record.session.consentStatus === "Recorded",
          }
        : a,
    ),
  };
  return audit(next, record, actor.name, "Status changed to " + target, note);
}
export function completeSession(
  s: ClinicState,
  id: string,
  actor: { role: string; name: string },
  confirmation: string,
): ClinicState {
  const r = s.records["Sittings & Sessions"].find((r) => r.id === id);
  if (!r?.session) throw new Error("Session not found.");
  const ledger = s.sessionCompletions || [],
    key = "completion-" + (r.appointmentId || r.id);
  if (ledger.some((e) => e.id === key) || r.status === "Completed") return s;
  if (!clinicalActor(actor.role))
    throw new Error(
      "A Doctor or Clinic Owner must review and complete the sitting.",
    );
  if (r.status !== "Awaiting Review")
    throw new Error(
      "Submit this sitting for clinician review before completion.",
    );
  if (!confirmation.trim())
    throw new Error(
      "Confirm completion and record a clinician completion note.",
    );
  const a = s.appointments.find((a) => a.id === r.appointmentId);
  if (a && ["Cancelled", "Rescheduled", "No-show"].includes(a.status))
    throw new Error(
      "Cancelled, rescheduled or no-show appointments cannot consume a sitting.",
    );
  const errors = startErrors(s, r),
    d = r.session;
  if ((r.date || DEMO_DATE) > DEMO_DATE)
    errors.push("A future sitting cannot be completed.");
  if (!d.startedAt)
    errors.push("A qualifying procedure must have been started.");
  if (
    !d.procedureNotes.trim() ||
    !d.tolerance.trim() ||
    !d.response.trim() ||
    !d.aftercare.trim() ||
    d.reaction === "Not assessed"
  )
    errors.push("Complete procedure documentation and reaction assessment.");
  if (!d.doctorReview.trim()) errors.push("Record the doctor review.");
  if (d.reaction === "Observed" && (!d.reactionNotes || !d.escalationNote))
    errors.push("Record adverse reaction details and clinician escalation.");
  if (errors.length) throw new Error(errors.join(" "));
  const balance = packageBalance(s, r);
  if (balance && d.number <= balance.used)
    throw new Error("This sitting is already included in course progress.");
  if (balance && d.number !== balance.used + 1)
    throw new Error("Record the next unconsumed course sitting in sequence.");
  if (a && a.sitting !== d.number)
    throw new Error("Session number must match the appointment.");
  if (a?.status === "Completed")
    throw new Error("This appointment was already completed.");
  if ((d.beforeImages.length || d.afterImages.length) && !d.imageConsent)
    throw new Error("Record image consent.");
  if (
    d.nextDate &&
    (safeDate(d.nextDate) !== d.nextDate || d.nextDate <= (r.date || DEMO_DATE))
  )
    throw new Error("Recommended next date must follow this sitting.");
  if (
    r.courseId &&
    ledger.some((e) => e.courseId === r.courseId && e.sitting === d.number)
  )
    throw new Error("This course sitting has already been consumed.");
  if (
    r.courseId &&
    s.records["Sittings & Sessions"].some(
      (v) =>
        v.id !== id &&
        v.courseId === r.courseId &&
        v.status === "Completed" &&
        v.session?.number === d.number,
    )
  )
    throw new Error(
      "A completed record already exists for this course sitting.",
    );
  const after = balance ? balance.remaining - 1 : 0,
    at = new Date().toISOString();
  const record = {
    ...r,
    status: "Completed",
    reviewedBy: actor.name,
    session: { ...d, completedAt: at, reviewedAt: at, reviewedBy: actor.name },
  };
  let next = replace(s, record);
  next = {
    ...next,
    sessionCompletions: [
      ...ledger,
      {
        id: key,
        sessionId: id,
        appointmentId: r.appointmentId,
        patientId: r.patientId!,
        courseId: r.courseId,
        sitting: d.number,
        at,
        doctor: actor.name,
        units: balance ? 1 : 0,
        packageBefore: balance?.remaining || 0,
        packageAfter: after,
        chargeAmount: 0,
      },
    ],
    patients: next.patients.map((p) =>
      p.id === r.patientId
        ? { ...p, lastVisit: dayLabel(r.date || DEMO_DATE) }
        : p,
    ),
    appointments: next.appointments.map((v) =>
      v.id === r.appointmentId
        ? { ...v, status: "Completed", consent: true }
        : v,
    ),
    records: {
      ...next.records,
      "Treatment Plans": next.records["Treatment Plans"].map((c) =>
        c.id === r.courseId
          ? {
              ...c,
              completedSittings: (c.completedSittings || 0) + 1,
              status: after === 0 ? "Completed" : "Active",
              course: c.course
                ? {
                    ...c.course,
                    lastCompletedDate: r.date,
                    nextRecommendedDate:
                      after > 0 ? d.nextDate || undefined : undefined,
                    completionConfirmed: false,
                  }
                : undefined,
            }
          : c,
      ),
      "Packages & Billing": next.records["Packages & Billing"].map((i) =>
        i.courseId === r.courseId && balance
          ? {
              ...i,
              packageSessions: {
                total: balance.total,
                used: balance.used + 1,
                remaining: after,
              },
            }
          : i,
      ),
      "Follow-ups": next.records["Follow-ups"].map((f) =>
        f.sessionId === id && f.followupKind === "Adverse reaction review"
          ? {
              ...f,
              status: "Completed",
              detail:
                f.detail + " | clinician review resolved by " + actor.name,
            }
          : f,
      ),
    },
  };
  if (d.nextDate) {
    const followup: RecordItem = {
      id: "aftercare-" + id,
      name: r.name,
      patientId: r.patientId,
      courseId: r.courseId,
      sessionId: id,
      followupKind: "Aftercare",
      date: r.date,
      dueDate: d.nextDate,
      status:
        d.nextDate < DEMO_DATE
          ? "Overdue"
          : d.nextDate === DEMO_DATE
            ? "Due today"
            : "Scheduled",
      amount: 0,
      detail: "Clinician-entered follow-up: " + d.aftercare,
    };
    next = {
      ...next,
      records: {
        ...next.records,
        "Follow-ups": [
          followup,
          ...next.records["Follow-ups"].filter((f) => f.id !== followup.id),
        ],
      },
    };
  }
  return audit(
    next,
    record,
    actor.name,
    "Sitting completed; " +
      (balance ? "one package session consumed" : "single visit recorded") +
      "; no automatic charge",
    confirmation,
  );
}
export function rescheduleSession(
  s: ClinicState,
  id: string,
  date: string,
  time: string,
  reason: string,
  actor: string,
) {
  const r = s.records["Sittings & Sessions"].find((r) => r.id === id);
  if (!r?.session || !r.appointmentId)
    throw new Error("Select a linked appointment.");
  if (
    ![
      "Scheduled",
      "Checked In",
      "In Preparation",
      "No-show",
      "Cancelled",
    ].includes(r.status) ||
    r.session.startedAt
  )
    throw new Error("Only an unstarted sitting can be rescheduled.");
  if (!reason.trim()) throw new Error("Enter a rescheduling reason.");
  if (
    !date ||
    safeDate(date) !== date ||
    date < DEMO_DATE ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  )
    throw new Error(
      "Choose a valid date on/after the clinic demo day and a time.",
    );
  const a = s.appointments.find((a) => a.id === r.appointmentId)!;
  const visit = {
    ...a,
    date,
    time,
    status: "Confirmed",
    audit: [
      ...(a.audit || []),
      {
        at: new Date().toISOString(),
        actor,
        action: "Rescheduled",
        note: reason,
      },
    ],
  };
  if (bookingErrors(s, visit).length)
    throw new Error(bookingErrors(s, visit).join(" "));
  if (bookingConflict(s, visit))
    throw new Error(
      "Patient, clinician, machine, technician or room is already booked.",
    );
  const record = {
    ...r,
    date,
    status: "Scheduled",
    session: {
      ...r.session,
      time,
      checks: {
        identity: false,
        history: false,
        parameters: false,
        machine: false,
      },
      parameterApprovalBy: "",
      parameterApprovalNote: "",
    },
  };
  return audit(
    {
      ...replace(s, record),
      appointments: s.appointments.map((a) => (a.id === visit.id ? visit : a)),
    },
    record,
    actor,
    "Appointment rescheduled without package deduction",
    reason,
  );
}
export function bookLinked(
  s: ClinicState,
  id: string,
  type: "sitting" | "followup",
  date: string,
  time: string,
  note: string,
  actor: string,
): { state: ClinicState; recordId: string } {
  const r = s.records["Sittings & Sessions"].find((r) => r.id === id);
  if (!r?.session) throw new Error("Session not found.");
  if (
    !date ||
    safeDate(date) !== date ||
    date < DEMO_DATE ||
    date <= (r.date || "")
  )
    throw new Error(
      "Choose a next date after this sitting and on/after the clinic day.",
    );
  if (!note.trim()) throw new Error("Enter the booking/follow-up note.");
  if (type === "followup") {
    const key = "aftercare-" + id;
    const f: RecordItem = {
      id: key,
      name: r.name,
      patientId: r.patientId,
      courseId: r.courseId,
      sessionId: id,
      followupKind: "Aftercare",
      date: DEMO_DATE,
      dueDate: date,
      status: "Scheduled",
      amount: 0,
      detail: note,
    };
    const next = {
      ...s,
      records: {
        ...s.records,
        "Follow-ups": [
          f,
          ...s.records["Follow-ups"].filter((v) => v.id !== key),
        ],
      },
    };
    return {
      state: audit(next, r, actor, "Follow-up booked", date + " | " + note),
      recordId: key,
    };
  }
  if (r.status !== "Completed")
    throw new Error(
      "Complete clinician review before booking the next package sitting.",
    );
  const b = packageBalance(s, r);
  if (!b || !b.remaining) throw new Error("No package sessions remain.");
  const number = b.used + 1;
  if (
    s.appointments.some(
      (a) =>
        a.courseId === r.courseId &&
        a.sitting === number &&
        !["Cancelled", "No-show", "Rescheduled"].includes(a.status),
    )
  )
    throw new Error(
      "The next sitting is already booked. Open it from the course timeline.",
    );
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new Error("Choose a valid appointment time.");
  const d = r.session,
    visit: Appointment = {
      id: "APT-" + crypto.randomUUID().slice(0, 8),
      patientId: r.patientId!,
      courseId: r.courseId,
      sitting: number,
      totalSittings: b.total,
      date,
      time,
      treatment:
        s.appointments.find((a) => a.id === r.appointmentId)?.treatment ||
        r.detail.split(" | ")[0],
      status: "Confirmed",
      bookingSource: "Session workspace",
      notes: note,
      audit: [
        {
          at: new Date().toISOString(),
          actor,
          action: "Next sitting booked",
          note,
        },
      ],
      doctor: d.reviewingDoctor,
      technician: d.operator,
      machineId: d.machineId || undefined,
      room: d.room,
      duration: s.records["Treatment Plans"].find((c) => c.id === r.courseId)
        ?.course
        ? s.records["Plan Proposals"].find(
            (p) =>
              p.id ===
              s.records["Treatment Plans"].find((c) => c.id === r.courseId)
                ?.course?.planId,
          )?.plan?.duration || 45
        : 45,
    };
  if (bookingErrors(s, visit).length)
    throw new Error(bookingErrors(s, visit).join(" "));
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || bookingConflict(s, visit))
    throw new Error(
      "Choose a valid, available time for this patient and care team.",
    );
  const linked = ensureSession(
    { ...s, appointments: [...s.appointments, visit] },
    visit.id,
  );
  return {
    state: audit(
      linked.state,
      r,
      actor,
      "Next sitting scheduled",
      date + " " + time + " | " + note,
    ),
    recordId: linked.record.id,
  };
}
export function configureDevice(
  s: ClinicState,
  id: string,
  config: DeviceDocumentation,
  role: string,
) {
  if (!clinicalActor(role))
    throw new Error("A clinician configures documentation fields.");
  if (
    !config.source.trim() ||
    !config.configuredBy.trim() ||
    !config.fields.length
  )
    throw new Error(
      "Enter the documentation source, configuring clinician and at least one field.",
    );
  const labels = new Set<string>();
  for (const f of config.fields) {
    if (
      !f.label.trim() ||
      !f.unit.trim() ||
      labels.has(f.label.trim().toLowerCase())
    )
      throw new Error("Use unique field labels and explicitly recorded units.");
    labels.add(f.label.trim().toLowerCase());
  }
  const old = s.records["Machines & Equipment"].find((m) => m.id === id);
  if (!old) throw new Error("Machine not found.");
  return {
    ...s,
    records: {
      ...s.records,
      "Machines & Equipment": s.records["Machines & Equipment"].map((m) =>
        m.id === id
          ? {
              ...m,
              deviceDocumentation: {
                ...config,
                version: (old.deviceDocumentation?.version || 0) + 1,
              },
            }
          : m,
      ),
    },
  };
}
export function savePolicy(
  s: ClinicState,
  policy: SessionPolicy,
  role: string,
) {
  if (role !== "Clinic Owner")
    throw new Error("Choose Clinic Owner to configure clinic checks.");
  return { ...s, sessionPolicy: policy };
}
export function recordConsent(
  s: ClinicState,
  r: RecordItem,
  doctor: string,
  note: string,
) {
  if (!doctor || !note.trim())
    throw new Error("Record the witnessing clinician and consent note.");
  const id = "consent-" + r.id;
  return {
    ...s,
    records: {
      ...s.records,
      "Clinical Documents": [
        {
          id,
          name: r.name,
          patientId: r.patientId,
          courseId: r.courseId,
          sessionId: r.id,
          status: "Recorded",
          date: DEMO_DATE,
          doctor,
          amount: 0,
          detail: "Fictional session consent | " + note,
          documentTemplate: (() => {
            const t = s.adminSettings?.consentTemplates.find(
              (t) => t.id === s.adminSettings?.defaultConsentId && t.active,
            );
            return t ? { id: t.id, name: t.name, content: t.body } : undefined;
          })(),
        },
        ...s.records["Clinical Documents"].filter((v) => v.id !== id),
      ],
    },
  };
}
export function suggestedNextDate(s: ClinicState, r: RecordItem) {
  const c = s.records["Treatment Plans"].find((c) => c.id === r.courseId);
  return c?.course ? addDays(r.date || DEMO_DATE, c.course.intervalDays) : "";
}
