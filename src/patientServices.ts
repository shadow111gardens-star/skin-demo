import type { ClinicState, Patient } from "./data";
import { DEMO_DATE } from "./data";
import { addDays } from "./services";
export const doctors = ["Dr. Aditi Shah", "Dr. Neha Kapoor", "Dr. Mehta"];
export const patientStatuses = [
  "Active",
  "New",
  "Completed",
  "Overdue",
  "Archived",
];
export function calculateAge(dob: string, asOf = DEMO_DATE) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || dob > asOf) return null;
  const b = new Date(dob + "T12:00:00Z");
  if (Number.isNaN(b.getTime()) || b.toISOString().slice(0, 10) !== dob)
    return null;
  const [y, m, d] = asOf.split("-").map(Number),
    [by, bm, bd] = dob.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}
export const normalizedPhone = (phone: string) =>
  phone.replace(/\D/g, "").slice(-10);
export function validPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return (
    /^\+?[\d ()-]+$/.test(phone) &&
    (/^[6-9]\d{9}$/.test(digits) || /^91[6-9]\d{9}$/.test(digits))
  );
}
export const validEmail = (email: string) =>
  !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export function likelyDuplicates(
  patients: Patient[],
  phone: string,
  email: string,
  excludeId?: string,
) {
  const mobile = normalizedPhone(phone),
    mail = email.trim().toLowerCase();
  return patients.filter(
    (p) =>
      p.id !== excludeId &&
      ((mobile.length === 10 && normalizedPhone(p.phone) === mobile) ||
        (mail && p.email?.toLowerCase() === mail)),
  );
}
export function generatePatientId(patients: Patient[]) {
  let id = "";
  do {
    id = "MM-" + crypto.randomUUID().slice(0, 8).toUpperCase();
  } while (patients.some((p) => p.id === id));
  return id;
}
export function effectivePatientStatus(
  s: ClinicState,
  p: Patient,
  date = DEMO_DATE,
) {
  if (p.status === "Archived") return "Archived";
  if (
    s.records["Follow-ups"].some(
      (r) =>
        r.patientId === p.id &&
        !["Completed", "Declined"].includes(r.status) &&
        (r.dueDate || DEMO_DATE) < date,
    )
  )
    return "Overdue";
  if (
    s.records["Treatment Plans"].some(
      (r) => r.patientId === p.id && r.status === "Active",
    )
  )
    return "Active";
  if (p.status === "Overdue")
    return s.records["Treatment Plans"].some(
      (r) => r.patientId === p.id && r.status === "Completed",
    )
      ? "Completed"
      : "Active";
  return p.status;
}
export function patientSummary(s: ClinicState, p: Patient, date = DEMO_DATE) {
  const appointments = s.appointments.filter((a) => a.patientId === p.id);
  const next = appointments
    .filter(
      (a) => a.date >= date && !["Cancelled", "Completed"].includes(a.status),
    )
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  const courses = s.records["Treatment Plans"].filter(
    (r) => r.patientId === p.id,
  );
  const active = courses.filter((r) => r.status === "Active");
  const outstanding = s.records["Packages & Billing"]
    .filter((r) => r.patientId === p.id && r.status !== "Paid")
    .reduce((n, r) => n + r.amount, 0);
  const dates = appointments
    .filter((a) => a.status === "Completed")
    .map((a) => a.date)
    .concat(
      s.records["Sittings & Sessions"]
        .filter(
          (r) => r.patientId === p.id && r.status === "Completed" && r.date,
        )
        .map((r) => r.date!),
    )
    .sort();
  const last = dates.at(-1);
  return {
    status: effectivePatientStatus(s, p, date),
    next,
    courses,
    active,
    outstanding,
    lastDate: last,
    lastVisit: last || p.lastVisit,
    doctor: p.assignedDoctor || next?.doctor || "Unassigned",
  };
}
export interface PatientFilters {
  q: string;
  status: string;
  treatment: string;
  doctor: string;
  next: string;
  sort: string;
}
export function filterPatients(
  s: ClinicState,
  filters: PatientFilters,
  date = DEMO_DATE,
) {
  const query = filters.q.trim().toLowerCase(),
    rawDigits = query.replace(/\D/g, ""),
    digits = rawDigits.length > 10 ? rawDigits.slice(-10) : rawDigits;
  return s.patients
    .filter((p) => {
      const meta = patientSummary(s, p, date);
      return (
        (!query ||
          `${p.name} ${p.id} ${p.phone}`.toLowerCase().includes(query) ||
          (digits.length >= 3 && normalizedPhone(p.phone).includes(digits))) &&
        (filters.status === "All" || meta.status === filters.status) &&
        (filters.treatment === "All" ||
          p.treatment === filters.treatment ||
          meta.courses.some((c) =>
            c.detail.toLowerCase().includes(filters.treatment.toLowerCase()),
          )) &&
        (filters.doctor === "All" || meta.doctor === filters.doctor) &&
        (filters.next === "All" ||
          (filters.next === "Today" && meta.next?.date === date) ||
          (filters.next === "Next 7 days" &&
            meta.next &&
            meta.next.date <= addDays(date, 7)) ||
          (filters.next === "No upcoming visit" && !meta.next))
      );
    })
    .sort((a, b) => {
      const ma = patientSummary(s, a, date),
        mb = patientSummary(s, b, date);
      if (filters.sort === "Balance: high to low")
        return mb.outstanding - ma.outstanding || a.name.localeCompare(b.name);
      if (filters.sort === "Next sitting")
        return (ma.next ? ma.next.date + ma.next.time : "9999").localeCompare(
          mb.next ? mb.next.date + mb.next.time : "9999",
        );
      if (filters.sort === "Recently registered")
        return (b.registeredAt || "").localeCompare(a.registeredAt || "");
      return filters.sort === "Name: Z–A"
        ? b.name.localeCompare(a.name)
        : a.name.localeCompare(b.name);
    });
}
export function updatePatient(s: ClinicState, patient: Patient): ClinicState {
  const before = s.patients.find((p) => p.id === patient.id);
  return {
    ...s,
    patients: s.patients.map((p) => (p.id === patient.id ? patient : p)),
    records: Object.fromEntries(
      Object.entries(s.records).map(([module, list]) => [
        module,
        list.map((r) =>
          r.patientId === patient.id && before
            ? { ...r, name: r.name.replace(before.name, patient.name) }
            : r,
        ),
      ]),
    ),
  };
}
