import { DEMO_DATE, type ClinicState, type RecordItem } from "../../data";
import { addDays } from "../../services";
import type { FollowupData, FollowupTab } from "./model";
export function followupData(r: RecordItem): FollowupData {
  return (
    r.followup || {
      assignedTo: r.doctor || "Riya Malhotra",
      outcome: "Not contacted",
      nextAction: "Review and contact",
      category: r.followupKind || "Routine review",
      contacts: [],
    }
  );
}
export function suggestedDate(s: ClinicState, r: RecordItem) {
  const c = s.records["Treatment Plans"].find((c) => c.id === r.courseId);
  const prior = s.records["Sittings & Sessions"]
    .filter(
      (v) =>
        v.patientId === r.patientId &&
        (!r.courseId || v.courseId === r.courseId) &&
        v.status === "Completed",
    )
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
  const lastDate = prior?.date || c?.course?.lastCompletedDate;
  return lastDate && c?.course?.intervalDays
    ? addDays(lastDate, c.course.intervalDays)
    : r.dueDate || DEMO_DATE;
}
export function reminderPaused(s: ClinicState, r: RecordItem) {
  return (
    s.records["Treatment Plans"].some(
      (c) => c.id === r.courseId && c.status === "Paused",
    ) ||
    s.records["Follow-ups"].some(
      (f) =>
        f.patientId === r.patientId &&
        f.followupKind === "Adverse reaction review" &&
        f.status !== "Completed",
    )
  );
}
export function followupRows(s: ClinicState, today: string): RecordItem[] {
  const generated: RecordItem[] = [];
  const add = (
    id: string,
    patientId: string,
    category: string,
    dueDate: string,
    detail: string,
    courseId?: string,
    appointmentId?: string,
  ) => {
    const p = s.patients.find((p) => p.id === patientId);
    if (p && p.status !== "Archived")
      generated.push({
        id,
        name: p.name,
        patientId,
        courseId,
        appointmentId,
        followupKind: category,
        dueDate,
        detail,
        status: "Scheduled",
        amount: 0,
        date: today,
      });
  };
  for (const a of s.appointments)
    if (
      a.status === "No-show" ||
      (a.date < today && ["Confirmed", "Checked in"].includes(a.status))
    )
      add(
        "missed-" + a.id,
        a.patientId,
        "Missed Appointment",
        a.date,
        "Attendance review required",
        a.courseId,
        a.id,
      );
  for (const c of s.records["Treatment Plans"]) {
    const last = s.records["Sittings & Sessions"]
      .filter((r) => r.courseId === c.id && r.status === "Completed")
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0]?.date;
    const lastDate = c.course?.lastCompletedDate || last;
    if (
      c.course?.validUntil &&
      c.status !== "Cancelled" &&
      c.course.validUntil <= addDays(today, 14)
    )
      add(
        "expiry-" + c.id,
        c.patientId!,
        "Package Nearing Expiry",
        c.course.validUntil,
        "Review package validity with the patient",
        c.id,
      );
    if (c.status === "Completed")
      add(
        "completion-" + c.id,
        c.patientId!,
        "Course Completion",
        lastDate || c.date || today,
        "Arrange clinician final review",
        c.id,
      );
    if (
      ["Active", "Paused"].includes(c.status) &&
      lastDate &&
      c.course &&
      !s.records["Follow-ups"].some(
        (f) =>
          f.id !== "course-review-" + c.id &&
          f.courseId === c.id &&
          !["Completed", "Declined"].includes(f.status),
      )
    )
      add(
        "course-review-" + c.id,
        c.patientId!,
        "Post-treatment Review",
        c.course.nextRecommendedDate ||
          addDays(lastDate!, c.course.intervalDays),
        "Review clinician-approved next interval",
        c.id,
      );
  }
  for (const p of s.patients)
    if (
      p.status === "Inactive" ||
      (p.status !== "Archived" &&
        !!p.registeredAt &&
        p.registeredAt.slice(0, 10) < addDays(today, -90) &&
        !s.appointments.some(
          (a) =>
            a.patientId === p.id &&
            a.date >= addDays(today, -90) &&
            !["Cancelled", "No-show"].includes(a.status),
        ))
    )
      add(
        "inactive-" + p.id,
        p.id,
        "Inactive Patient",
        today,
        "Review contact preference before outreach",
      );
  const generatedIds = new Set(generated.map((r) => r.id));
  const stored = new Map(s.records["Follow-ups"].map((r) => [r.id, r]));
  const live = generated.map((g) => {
    const old = stored.get(g.id),
      d = old ? followupData(old) : followupData(g);
    return {
      ...g,
      ...old,
      dueDate: d.dateOverridden ? old?.dueDate : g.dueDate,
      followup: { ...d, generated: true },
    };
  });
  const others = s.records["Follow-ups"]
    .filter((r) => !generatedIds.has(r.id))
    .map((r) =>
      r.followup?.generated && !["Completed", "Declined"].includes(r.status)
        ? {
            ...r,
            status: "Completed",
            followup: {
              ...r.followup,
              outcome: "Source no longer requires follow-up",
              nextAction: "No routine outreach",
            },
          }
        : r,
    );
  return [...others, ...live]
    .filter((r) => s.patients.some((p) => p.id === r.patientId))
    .map((r) => ({
      ...r,
      followup: followupData(r),
      status: ["Completed", "Declined"].includes(r.status)
        ? r.status
        : (r.dueDate || today) < today
          ? "Overdue"
          : (r.dueDate || today) === today
            ? "Due today"
            : "Scheduled",
    }));
}
export function materializeFollowups(s: ClinicState): ClinicState {
  return {
    ...s,
    records: { ...s.records, "Follow-ups": followupRows(s, DEMO_DATE) },
  };
}

export function inFollowupTab(
  s: ClinicState,
  r: RecordItem,
  tab: FollowupTab,
  today: string,
) {
  const done = ["Completed", "Declined"].includes(r.status),
    kind = r.followupKind || r.followup?.category || "";
  if (done) return false;
  switch (tab) {
    case "Due Today":
      return r.dueDate === today;
    case "Due Soon":
      return (
        (r.dueDate || "") > today && (r.dueDate || "") <= addDays(today, 7)
      );
    case "Overdue":
      return (r.dueDate || today) < today;
    case "Reaction Requiring Review":
      return /reaction/i.test(kind);
    case "Post-treatment Review":
      return (
        /aftercare|post-treatment/i.test(kind) || !!r.sessionId || !!r.courseId
      );
    default:
      return kind === tab;
  }
}

export function reminderText(s: ClinicState, r: RecordItem) {
  const p = s.patients.find((p) => p.id === r.patientId);
  const template = s.adminSettings?.reminderTemplates.find(
    (t) => t.id === s.adminSettings?.defaultReminderId && t.active,
  );
  if (template)
    return template.body
      .replaceAll("{firstName}", p?.name.split(" ")[0] || "there")
      .replaceAll("{clinicName}", s.clinicName)
      .replaceAll("{date}", r.dueDate || "")
      .replaceAll("{datePhrase}", r.dueDate ? " around " + r.dueDate : "");
  return `Hello ${p?.name.split(" ")[0] || "there"}, this is ${s.clinicName}. Please contact our reception to arrange your next visit${r.dueDate ? " around " + r.dueDate : ""}. Thank you.`;
}
