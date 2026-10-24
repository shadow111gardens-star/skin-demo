import { type ClinicState, type RecordItem } from "../../data";
import { roles } from "../../auth";
import { validPhone, validEmail, normalizedPhone } from "../../patientServices";
import { addActivity } from "../../store";
export function saveStaff(s: ClinicState, r: RecordItem) {
  const d = r.staff,
    old = s.records["Staff & Roles"].find((v) => v.id === r.id);
  if (
    !d ||
    r.name.trim().length < 2 ||
    !roles.includes(d.role) ||
    !validPhone(d.phone) ||
    !validEmail(d.email) ||
    !["Active", "Inactive"].includes(r.status) ||
    !["Available", "On leave", "Unavailable"].includes(d.availability)
  )
    throw new Error(
      "Enter a full name, demo role, valid Indian mobile, optional email, status and availability.",
    );
  if (
    s.records["Staff & Roles"].some(
      (v) =>
        v.id !== r.id &&
        v.name.trim().toLowerCase() === r.name.trim().toLowerCase(),
    )
  )
    throw new Error(
      "Use a unique staff display name for resource assignments.",
    );
  if (
    s.records["Staff & Roles"].some(
      (v) =>
        v.id !== r.id &&
        v.staff &&
        (normalizedPhone(v.staff.phone) === normalizedPhone(d.phone) ||
          (!!d.email && v.staff.email.toLowerCase() === d.email.toLowerCase())),
    )
  )
    throw new Error(
      "This mobile/email is already assigned to another staff profile.",
    );
  if (
    old?.staff?.role !== d.role &&
    old &&
    s.appointments.some(
      (a) =>
        !["Completed", "Cancelled", "No-show"].includes(a.status) &&
        (a.doctor === old.name || a.technician === old.name),
    )
  )
    throw new Error(
      "Reassign the active appointments before changing this staff role.",
    );
  const name = r.name.trim(),
    previousNames = [
      ...new Set([
        ...(old?.staff?.previousNames || []),
        ...(old && old.name !== name ? [old.name] : []),
      ]),
    ];
  let next: ClinicState = {
    ...s,
    records: {
      ...s.records,
      "Staff & Roles": s.records["Staff & Roles"].some((v) => v.id === r.id)
        ? s.records["Staff & Roles"].map((v) =>
            v.id === r.id
              ? {
                  ...r,
                  name,
                  detail: d.notes,
                  staff: {
                    ...d,
                    email: d.email.trim().toLowerCase(),
                    previousNames,
                  },
                }
              : v,
          )
        : [
            {
              ...r,
              name,
              detail: d.notes,
              staff: {
                ...d,
                email: d.email.trim().toLowerCase(),
                previousNames,
              },
            },
            ...s.records["Staff & Roles"],
          ],
    },
  };
  if (old && old.name !== name) {
    const replace = (v?: string) => (v === old.name ? name : v);
    next = {
      ...next,
      patients: next.patients.map((p) => ({
        ...p,
        assignedDoctor: replace(p.assignedDoctor),
      })),
      appointments: next.appointments.map((a) =>
        ["Completed", "Cancelled", "No-show"].includes(a.status)
          ? a
          : {
              ...a,
              doctor: replace(a.doctor)!,
              technician: replace(a.technician),
            },
      ),
      records: {
        ...next.records,
        "Sittings & Sessions": next.records["Sittings & Sessions"].map((r) =>
          r.session && !["Completed", "Cancelled", "No-show"].includes(r.status)
            ? {
                ...r,
                session: {
                  ...r.session,
                  operator: replace(r.session.operator)!,
                  reviewingDoctor: replace(r.session.reviewingDoctor)!,
                },
              }
            : r,
        ),
        "Treatment Plans": next.records["Treatment Plans"].map((r) =>
          r.course && !["Completed", "Cancelled"].includes(r.status)
            ? {
                ...r,
                course: {
                  ...r.course,
                  assignedDoctor: replace(r.course.assignedDoctor),
                  technician: replace(r.course.technician)!,
                },
              }
            : r,
        ),
        Maintenance: next.records.Maintenance.map((r) =>
          r.maintenance && !["Completed", "Cancelled"].includes(r.status)
            ? {
                ...r,
                maintenance: {
                  ...r.maintenance,
                  assignedTo: replace(r.maintenance.assignedTo)!,
                },
              }
            : r,
        ),
        "Leads & Enquiries": next.records["Leads & Enquiries"].map((r) =>
          r.lead
            ? {
                ...r,
                lead: { ...r.lead, assignedTo: replace(r.lead.assignedTo)! },
              }
            : r,
        ),
      },
    };
  }
  return addActivity(
    next,
    `${name}: demo staff profile saved; no login account was created.`,
  );
}
