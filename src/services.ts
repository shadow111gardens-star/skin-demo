import { recordFinancePayment } from "./features/finance/services";
import { financeSummary } from "./features/finance/ledger";
import { followupRows } from "./features/scheduling/followupLogic";
import { type ClinicState, type RecordItem, DEMO_DATE } from "./data";
export function dayLabel(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(`${date}T12:00:00+05:30`));
}
export function addDays(date: string, amount: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}
export function followupStatus(r: RecordItem, date: string) {
  if (["Completed", "Declined"].includes(r.status)) return r.status;
  return (r.dueDate || DEMO_DATE) < date
    ? "Overdue"
    : (r.dueDate || DEMO_DATE) === date
      ? "Due today"
      : "Scheduled";
}
export function dashboardStats(s: ClinicState, date: string) {
  const visits = s.appointments.filter(
    (a) => a.date === date && !["Cancelled", "Waiting list"].includes(a.status),
  );
  const followups = followupRows(s, date).filter(
    (r) => !["Completed", "Declined"].includes(r.status),
  );
  return {
    appointments: visits.length,
    laser: visits.filter((a) => a.treatment.toLowerCase().includes("laser"))
      .length,
    checkedIn: visits.filter((a) => a.status === "Checked in").length,
    followups: followups.filter((r) => followupStatus(r, date) === "Due today")
      .length,
    overdue: new Set(
      followups
        .filter((r) => followupStatus(r, date) === "Overdue")
        .map((r) => r.patientId || r.id),
    ).size,
    courses: (s.records["Treatment Plans"] || []).filter(
      (r) => r.status === "Active",
    ).length,
    collections: financeSummary(s, date, date).collections,
    outstanding: financeSummary(s, "0000-01-01", date).outstanding,
  };
}
export function recordPayment(
  s: ClinicState,
  patientId: string,
  amount: number,
  date: string,
  invoiceId?: string,
): ClinicState {
  return recordFinancePayment(
    s,
    {
      id: crypto.randomUUID(),
      patientId,
      amount,
      date,
      invoiceId,
      method: "UPI",
      reference: "DEMO-" + crypto.randomUUID(),
      note: "Simulated clinic receipt",
    },
    true,
  );
}

export function safeDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return DEMO_DATE;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? DEMO_DATE
    : value;
}
export function completeAppointment(s: ClinicState, id: string): ClinicState {
  const visit = s.appointments.find((a) => a.id === id);
  if (
    !visit ||
    ["Completed", "Cancelled", "Rescheduled", "No-show"].includes(visit.status)
  )
    return s;
  throw new Error(
    "Open the session workspace for documented clinician review and completion.",
  );
}
export function bookingConflict(
  s: ClinicState,
  visit: import("./data").Appointment,
) {
  const minutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };
  const start = minutes(visit.time),
    end = start + (visit.duration || 45);
  return s.appointments.find(
    (a) =>
      a.id !== visit.id &&
      !["Cancelled", "No-show", "Rescheduled", "Waiting list"].includes(
        a.status,
      ) &&
      a.date === visit.date &&
      minutes(a.time) < end &&
      minutes(a.time) + (a.duration || 45) > start &&
      (a.patientId === visit.patientId ||
        a.doctor === visit.doctor ||
        (a.room && a.room === visit.room) ||
        (a.technician && a.technician === visit.technician) ||
        (a.machineId && a.machineId === visit.machineId)),
  );
}
