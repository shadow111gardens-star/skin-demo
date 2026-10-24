export const roles = [
  "Clinic Owner",
  "Doctor",
  "Receptionist",
  "Laser Technician",
] as const;
export type Role = (typeof roles)[number];
export interface DemoSession {
  role: Role;
  email: string;
  name: string;
}
export function readSession(): DemoSession | null {
  try {
    const value =
      sessionStorage.getItem("mmverse-session") ||
      localStorage.getItem("mmverse-session");
    const session = value ? JSON.parse(value) : null;
    return session && roles.includes(session.role) ? session : null;
  } catch {
    return null;
  }
}
export function saveSession(session: DemoSession, remember: boolean) {
  sessionStorage.setItem("mmverse-session", JSON.stringify(session));
  localStorage.removeItem("mmverse-session");
  if (remember)
    localStorage.setItem("mmverse-session", JSON.stringify(session));
  localStorage.setItem("mmverse-role", session.role);
}
export function visibleModules(role: Role) {
  if (role === "Clinic Owner") return null;
  if (role === "Doctor")
    return [
      "Dashboard",
      "Patients",
      "Skin Analysis",
      "Consultations",
      "Treatment Catalogue",
      "Treatment Plans",
      "Sittings & Sessions",
      "Appointments",
      "Follow-ups",
      "Clinical Documents",
      "Machines & Equipment",
      "Rooms & Resources",
      "Reports & Analytics",
    ];
  if (role === "Receptionist")
    return [
      "Dashboard",
      "Patients",
      "Skin Analysis",
      "Appointments",
      "Sittings & Sessions",
      "Follow-ups",
      "Clinical Documents",
      "Packages & Billing",
      "Payments",
      "Leads & Enquiries",
      "Machines & Equipment",
      "Maintenance",
      "Inventory",
      "Rooms & Resources",
    ];
  return [
    "Dashboard",
    "Patients",
    "Skin Analysis",
    "Treatment Catalogue",
    "Treatment Plans",
    "Sittings & Sessions",
    "Appointments",
    "Follow-ups",
    "Machines & Equipment",
    "Rooms & Resources",
    "Maintenance",
    "Inventory",
  ];
}
export const canClinical = (role: Role) =>
  role === "Clinic Owner" || role === "Doctor" || role === "Laser Technician";
export const canBill = (role: Role) =>
  role === "Clinic Owner" || role === "Receptionist";
export const canBook = (role: Role) => role !== "Laser Technician";
