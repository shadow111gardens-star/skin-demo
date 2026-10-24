import { type ClinicState } from "../../data";
import { defaultAdminSettings } from "./model";
import type { Role } from "../../auth";
export function enrichAdmin(s: ClinicState) {
  if (s.adminSchemaVersion === 1) return s;
  s.adminSchemaVersion = 1;
  s.adminSettings = defaultAdminSettings();
  s.notificationState ||= { read: {}, dismissed: {} };
  s.records["Staff & Roles"] = s.records["Staff & Roles"].map((r, i) =>
    r.staff
      ? r
      : {
          ...r,
          status: r.status === "Inactive" ? "Inactive" : "Active",
          staff: {
            role: (r.detail.toLowerCase().includes("reception") ||
            r.name.includes("Riya")
              ? "Receptionist"
              : "Doctor") as Role,
            phone: "900000" + String(1101 + i),
            email:
              r.name
                .toLowerCase()
                .replace(/[^a-z]+/g, ".")
                .replace(/^\.|\.$/g, "") + "@example.test",
            availability: "Available",
            notes: r.detail,
            previousNames: [],
          },
        },
  );
  for (const [id, name, role, phone] of [
    ["staff-owner", "Dr. Mehta", "Clinic Owner", "9000001104"],
    ["staff-tech-aarav", "Aarav Singh", "Laser Technician", "9000001105"],
    ["staff-tech-neha", "Neha Rao", "Laser Technician", "9000001106"],
  ])
    if (!s.records["Staff & Roles"].some((r) => r.id === id))
      s.records["Staff & Roles"].push({
        id,
        name,
        status: "Active",
        detail: "Fictional demo clinic staff record",
        amount: 0,
        staff: {
          role: role as Role,
          phone,
          email:
            name
              .toLowerCase()
              .replace(/[^a-z]+/g, ".")
              .replace(/^\.|\.$/g, "") + "@example.test",
          availability: "Available",
          notes: "Fictional staff profile; no authentication account created.",
          previousNames: [],
        },
      });
  return s;
}
