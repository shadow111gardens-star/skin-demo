import { DEMO_DATE, type ClinicState, type RecordItem } from "../../data";
import { activeMaintenance, machineBlocked } from "./model";
export function machineStatus(s: ClinicState, m: RecordItem, date = DEMO_DATE) {
  if (machineBlocked(m.status))
    return m.status === "Maintenance" ? "Under Maintenance" : m.status;
  if (
    s.records["Maintenance"].some(
      (t) => t.machineId === m.id && activeMaintenance(t.status),
    )
  )
    return "Under Maintenance";
  if (
    s.records["Sittings & Sessions"].some(
      (r) =>
        r.date === date &&
        r.session?.machineId === m.id &&
        r.status === "In Progress",
    ) ||
    s.appointments.some(
      (a) =>
        a.machineId === m.id && a.date === date && a.status === "In progress",
    )
  )
    return "In Use";
  return m.status === "In use" ? "In Use" : m.status;
}
export function roomFor(s: ClinicState, value: string) {
  return (s.records["Rooms & Resources"] || []).find(
    (r) => r.id === value || r.room?.code === value,
  );
}
export function machineRestriction(s: ClinicState, id: string) {
  const m = s.records["Machines & Equipment"].find((m) => m.id === id);
  if (!m) return "Choose an existing machine.";
  if (machineBlocked(machineStatus(s, m)))
    return (
      m.name +
      " is under maintenance or unavailable; service clearance is required."
    );
  if (m.status === "In Use")
    return (
      m.name +
      " is manually marked in use; restore availability or review the resource assignment."
    );
  return "";
}
export function roomRestriction(s: ClinicState, value: string) {
  const r = roomFor(s, value);
  return r && r.status !== "Available"
    ? r.room!.code + " is unavailable for booking."
    : "";
}
export function compatibleTreatments(s: ClinicState, id: string) {
  return s.records["Treatment Catalogue"].filter((t) =>
    t.treatment?.machineIds.includes(id),
  );
}
export function machineUsage(s: ClinicState, id: string, date = DEMO_DATE) {
  const visits = s.appointments.filter(
      (a) =>
        a.machineId === id &&
        a.date === date &&
        !["Cancelled", "No-show", "Waiting list", "Rescheduled"].includes(
          a.status,
        ),
    ),
    sessions = s.records["Sittings & Sessions"].filter(
      (r) => r.session?.machineId === id,
    ),
    m = s.records["Machines & Equipment"].find((m) => m.id === id);
  const minutes = visits.reduce((n, a) => n + (a.duration || 0), 0);
  let shots: number | undefined;
  for (const r of sessions)
    for (const f of r.session!.parameterSchema) {
      const value = r.session!.parameters[f.id];
      if (
        /shot.*count|^shots$/i.test(f.label) &&
        value?.trim() &&
        Number.isFinite(Number(value))
      )
        shots = (shots || 0) + Number(value);
    }
  const downtime =
    s.records["Maintenance"]
      .filter(
        (t) =>
          t.machineId === id &&
          t.maintenance?.startedAt &&
          t.maintenance.clearedAt,
      )
      .reduce(
        (n, t) =>
          n +
          Math.max(
            0,
            new Date(t.maintenance!.clearedAt!).getTime() -
              new Date(t.maintenance!.startedAt!).getTime(),
          ),
        0,
      ) / 3600000;
  return {
    visits,
    sessions,
    minutes,
    utilisation: m?.machine?.planningMinutes
      ? Math.round((minutes / m.machine.planningMinutes) * 100)
      : null,
    shots,
    downtime,
  };
}
export function stockStatus(r: RecordItem, date = DEMO_DATE) {
  const p = r.inventory;
  if (!p) return r.status;
  if (p.expiry && p.expiry < date) return "Expired";
  if (p.quantity <= p.minimumStock) return "Low stock";
  return "In stock";
}
