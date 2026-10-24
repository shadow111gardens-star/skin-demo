import { type ClinicState, DEMO_DATE, modules, slug } from "../../data";
import { visibleModules, type Role } from "../../auth";
import { normalizedPhone } from "../../patientServices";
import { expiringCourses } from "../finance/packageSelectors";
import { addDays } from "../../services";
import { followupRows } from "../scheduling/followupLogic";
import { defaultAdminSettings, type NotificationCategory } from "./model";
export interface SearchResult {
  id: string;
  group:
    "Patients" | "Treatment courses" | "Appointments" | "Machines" | "Modules";
  label: string;
  detail: string;
  href: string;
  patientId?: string;
}
export function globalSearch(
  s: ClinicState,
  query: string,
  role: Role,
): SearchResult[] {
  const q = query.trim().toLowerCase(),
    digits = query.replace(/\D/g, "").slice(-10),
    allowed = visibleModules(role),
    can = (module: string) => !allowed || allowed.includes(module),
    match = (text: string, phone = "") =>
      text.toLowerCase().includes(q) ||
      (digits.length >= 3 && normalizedPhone(phone).includes(digits));
  if (!q)
    return modules
      .filter(can)
      .slice(0, 6)
      .map((m) => ({
        id: "module-" + m,
        group: "Modules",
        label: m,
        detail: "Open module",
        href: "/" + slug(m),
      }));
  const rows: SearchResult[] = [];
  if (can("Patients"))
    for (const p of s.patients)
      if (match(p.name + " " + p.id + " " + p.phone, p.phone))
        rows.push({
          id: p.id,
          group: "Patients",
          label: p.name,
          detail: p.id + " · " + p.phone + " · " + p.status,
          href: "/patients/" + encodeURIComponent(p.id),
          patientId: p.id,
        });
  if (can("Treatment Plans"))
    for (const r of s.records["Treatment Plans"]) {
      const p = s.patients.find((p) => p.id === r.patientId);
      if (
        match(
          r.id +
            " " +
            r.name +
            " " +
            r.detail +
            " " +
            r.course?.treatmentName +
            " " +
            r.course?.area +
            " " +
            r.patientId +
            " " +
            p?.phone,
          p?.phone,
        )
      )
        rows.push({
          id: r.id,
          group: "Treatment courses",
          label: r.course?.treatmentName || r.name,
          detail: r.id + " · " + (p?.name || r.name) + " · " + r.status,
          href: "/treatment-plans/courses/" + encodeURIComponent(r.id),
        });
    }
  if (can("Appointments"))
    for (const a of s.appointments) {
      const p = s.patients.find((p) => p.id === a.patientId);
      if (
        match(
          a.id +
            " " +
            p?.name +
            " " +
            a.patientId +
            " " +
            a.date +
            " " +
            a.time +
            " " +
            a.treatment +
            " " +
            a.doctor +
            " " +
            p?.phone,
          p?.phone,
        )
      )
        rows.push({
          id: a.id,
          group: "Appointments",
          label: (p?.name || a.patientId) + " · " + a.time,
          detail:
            a.id + " · " + a.date + " · " + a.treatment + " · " + a.status,
          href:
            "/appointments?appointment=" +
            encodeURIComponent(a.id) +
            "&date=" +
            a.date,
        });
    }
  if (can("Machines & Equipment"))
    for (const r of s.records["Machines & Equipment"])
      if (
        match(
          r.id +
            " " +
            r.name +
            " " +
            r.machine?.brand +
            " " +
            r.machine?.model +
            " " +
            r.machine?.serial,
        )
      )
        rows.push({
          id: r.id,
          group: "Machines",
          label: r.name,
          detail: r.machine?.serial + " · " + r.status,
          href: "/machines-equipment/" + encodeURIComponent(r.id),
        });
  for (const m of modules.filter(can))
    if (match(m))
      rows.push({
        id: "module-" + m,
        group: "Modules",
        label: m,
        detail: "Open module",
        href: "/" + slug(m),
      });
  return rows;
}
export interface ClinicNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  detail: string;
  module: string;
  href: string;
  fingerprint: string;
  read: boolean;
  dismissed: boolean;
}
export function clinicNotifications(
  s: ClinicState,
  role: Role,
  date = DEMO_DATE,
): ClinicNotification[] {
  const prefs = (s.adminSettings || defaultAdminSettings()).notifications,
    allowed = visibleModules(role),
    rows: ClinicNotification[] = [];
  function add(
    id: string,
    category: NotificationCategory,
    title: string,
    detail: string,
    module: string,
    href: string,
    version: string,
  ) {
    if (!prefs.enabled[category] || (allowed && !allowed.includes(module)))
      return;
    const fingerprint = JSON.stringify([id, title, detail, version]);
    rows.push({
      id,
      category,
      title,
      detail,
      module,
      href,
      fingerprint,
      read: s.notificationState?.read[id] === fingerprint,
      dismissed: s.notificationState?.dismissed[id] === fingerprint,
    });
  }
  const followups = followupRows(s, date).filter(
    (r) => !["Completed", "Declined"].includes(r.status),
  );
  for (const r of followups.filter((r) => r.dueDate === date))
    add(
      "followup-" + r.id,
      "Due follow-ups",
      r.name + " follow-up due today",
      r.detail + " · " + r.dueDate,
      "Follow-ups",
      "/follow-ups?record=" + r.id + "&date=" + date,
      r.status + "|" + r.followup?.outcome,
    );
  const overdue = new Map<string, typeof followups>();
  for (const r of followups.filter((r) => (r.dueDate || date) < date))
    overdue.set(r.patientId || r.id, [
      ...(overdue.get(r.patientId || r.id) || []),
      r,
    ]);
  for (const [id, records] of overdue) {
    const first = records
      .slice()
      .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))[0];
    add(
      "overdue-" + id,
      "Overdue patients",
      (s.patients.find((p) => p.id === id)?.name || first.name) +
        " needs a follow-up",
      records.length + " overdue item(s) · earliest " + first.dueDate,
      "Follow-ups",
      "/follow-ups?record=" + first.id + "&date=" + date,
      records
        .map((r) => r.id + ":" + r.dueDate + ":" + r.status)
        .sort()
        .join("|"),
    );
  }
  for (const a of s.appointments.filter(
    (a) =>
      a.date >= date &&
      a.date <= addDays(date, prefs.appointmentDays) &&
      ["Confirmed", "Checked in", "In preparation"].includes(a.status),
  ))
    add(
      "appointment-" + a.id,
      "Upcoming appointments",
      (s.patients.find((p) => p.id === a.patientId)?.name || a.patientId) +
        " appointment",
      a.date + " · " + a.time + " IST · " + a.treatment,
      "Appointments",
      "/appointments?appointment=" + a.id + "&date=" + a.date,
      [a.status, a.doctor, a.room, a.machineId, a.technician].join("|"),
    );
  for (const r of expiringCourses(s, date, prefs.expiryDays))
    add(
      "package-" + r.id,
      "Expiring packages",
      r.name + " package nearing expiry",
      r.course?.treatmentName + " · expires " + r.course?.validUntil,
      "Treatment Plans",
      "/treatment-plans/courses/" + r.id,
      r.status + "|" + r.completedSittings + "|" + r.course?.packagePrice,
    );
  for (const r of s.records.Maintenance.filter(
    (r) =>
      !["Completed", "Cancelled"].includes(r.status) &&
      (["In Progress", "Awaiting Clearance"].includes(r.status) ||
        (r.dueDate || "9999") <= addDays(date, prefs.maintenanceDays)),
  ))
    add(
      "maintenance-" + r.id,
      "Maintenance",
      r.name + " service reminder",
      (s.records["Machines & Equipment"].find((m) => m.id === r.machineId)
        ?.name || "Equipment") +
        " · " +
        r.dueDate +
        " · " +
        r.status,
      "Maintenance",
      "/maintenance?machine=" + r.machineId + "&task=" + r.id,
      r.maintenance?.notes + "|" + r.maintenance?.assignedTo,
    );
  for (const r of s.records.Inventory.filter(
    (r) => r.inventory && r.inventory.quantity <= r.inventory.minimumStock,
  ))
    add(
      "stock-" + r.id,
      "Low stock",
      r.name + " below reorder level",
      r.inventory!.quantity +
        " " +
        r.inventory!.unit +
        " remaining · minimum " +
        r.inventory!.minimumStock +
        " · " +
        r.inventory!.batch,
      "Inventory",
      "/inventory?record=" + r.id,
      r.inventory!.expiry,
    );
  return rows;
}
export function notificationAction(
  s: ClinicState,
  action: "read" | "unread" | "dismiss" | "read-all" | "restore",
  notifications: ClinicNotification[],
  id?: string,
): ClinicState {
  const state = {
    read: { ...(s.notificationState?.read || {}) },
    dismissed: { ...(s.notificationState?.dismissed || {}) },
  };
  const list = id ? notifications.filter((n) => n.id === id) : notifications;
  if (action === "restore") state.dismissed = {};
  else
    for (const n of list) {
      if (action === "read" || action === "read-all")
        state.read[n.id] = n.fingerprint;
      if (action === "unread") delete state.read[n.id];
      if (action === "dismiss") state.dismissed[n.id] = n.fingerprint;
    }
  return { ...s, notificationState: state };
}
