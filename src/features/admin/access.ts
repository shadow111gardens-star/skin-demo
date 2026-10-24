import type { ClinicState, RecordItem } from "../../data";
import {
  roles,
  type Role,
  visibleModules,
  canClinical,
  canBook,
  canBill,
} from "../../auth";
import { modules, slug } from "../../data";
export function moduleForPath(path: string) {
  return (
    modules.find(
      (m) => path === "/" + slug(m) || path.startsWith("/" + slug(m) + "/"),
    ) ||
    (/^\/(packages|invoices)(\/|$)/.test(path)
      ? "Packages & Billing"
      : "Dashboard")
  );
}
export function roleGuide(role: Role) {
  return [
    { group: "Clinical documentation", view: true, manage: canClinical(role) },
    { group: "Appointments", view: true, manage: canBook(role) },
    {
      group: "Equipment & resources",
      view: visibleModules(role)?.includes("Machines & Equipment") ?? true,
      manage: true,
    },
    { group: "Billing & payments", view: canBill(role), manage: canBill(role) },
    {
      group: "Reports",
      view: role === "Clinic Owner" || role === "Doctor",
      manage: false,
    },
    {
      group: "Administration settings",
      view: role === "Clinic Owner",
      manage: role === "Clinic Owner",
    },
  ];
}
export { roles };
export function staffFor(s: ClinicState, role: Role) {
  return s.records["Staff & Roles"].filter(
    (r) =>
      r.staff &&
      (r.staff.role === role ||
        (role === "Doctor" &&
          r.staff.role === "Clinic Owner" &&
          r.name.startsWith("Dr."))),
  );
}
export function clinicDoctors(s: ClinicState) {
  const list = staffFor(s, "Doctor")
    .filter(
      (r) => r.status === "Active" && r.staff?.availability === "Available",
    )
    .map((r) => r.name);
  return s.adminSchemaVersion
    ? list
    : ["Dr. Aditi Shah", "Dr. Neha Kapoor", "Dr. Mehta"];
}
export function clinicTechnicians(s: ClinicState) {
  const list = staffFor(s, "Laser Technician")
    .filter(
      (r) => r.status === "Active" && r.staff?.availability === "Available",
    )
    .map((r) => r.name);
  return [
    ...(s.adminSchemaVersion ? list : ["Aarav Singh", "Neha Rao"]),
    "Not assigned",
  ];
}
export function staffRestriction(
  s: ClinicState,
  name: string,
  role: "Doctor" | "Laser Technician",
) {
  const r = s.records["Staff & Roles"].find(
    (r) => r.name === name || r.staff?.previousNames.includes(name),
  );
  if (!r?.staff) return "";
  if (r.status !== "Active" || r.staff.availability !== "Available")
    return (
      r.name +
      " is currently marked unavailable or inactive in the demo staff directory."
    );
  if (
    r.staff.role !== role &&
    !(role === "Doctor" && r.staff.role === "Clinic Owner")
  )
    return r.name + " is not assigned the required demo staff role.";
  return "";
}
export function quickContext(s: ClinicState, path: string, search: string) {
  const parts = path.split("/").filter(Boolean);
  let patientId = "",
    courseId = "";
  if (parts[0] === "patients" && s.patients.some((p) => p.id === parts[1]))
    patientId = parts[1];
  let r: RecordItem | undefined;
  if (parts[0] === "treatment-plans" && parts[1] === "courses")
    r = s.records["Treatment Plans"].find((r) => r.id === parts[2]);
  if (parts[0] === "sittings-sessions")
    r = s.records["Sittings & Sessions"].find(
      (r) => r.id === parts[1] || r.appointmentId === parts[1],
    );
  if (parts[0] === "skin-analysis")
    r = s.records["Skin Analysis"].find((r) => r.id === parts[1]);
  if (parts[0] === "invoices")
    r = s.records["Packages & Billing"].find((r) => r.id === parts[1]);
  if (r) {
    patientId = r.patientId || "";
    courseId = r.course ? r.id : r.courseId || "";
  }
  const query = new URLSearchParams(search);
  if (parts[0] === "appointments") {
    const a = s.appointments.find(
      (a) => a.id === (query.get("appointment") || query.get("record")),
    );
    patientId = a?.patientId || patientId;
    courseId = a?.courseId || courseId;
  }
  if (parts[0] === "leads-enquiries") {
    const l = s.records["Leads & Enquiries"].find(
      (l) => l.id === (query.get("lead") || query.get("record")),
    );
    patientId = l?.patientId || patientId;
  }
  return {
    patientId,
    courseId,
    label: s.patients.find((p) => p.id === patientId)?.name || "",
    invoiceId: r?.invoice ? r.id : undefined,
  };
}
