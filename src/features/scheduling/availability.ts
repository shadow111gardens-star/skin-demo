import { staffRestriction } from "../admin/access";
import {
  machineRestriction,
  roomRestriction,
  roomFor,
} from "../operations/selectors";
import { DEMO_DATE, type Appointment, type ClinicState } from "../../data";
import { safeDate, addDays } from "../../services";
export const minutes = (t: string) =>
  Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const activeBooking = (a: Appointment) =>
  !["Cancelled", "No-show", "Rescheduled", "Waiting list"].includes(a.status);
export function treatmentConfig(s: ClinicState, a: Appointment) {
  const c = s.records["Treatment Plans"].find((c) => c.id === a.courseId);
  return s.records["Treatment Catalogue"].find(
    (t) =>
      t.id === c?.course?.treatmentId ||
      t.name.toLowerCase() === a.treatment.toLowerCase(),
  )?.treatment;
}
export function bookingErrors(s: ClinicState, a: Appointment) {
  const errors: string[] = [],
    p = s.patients.find((p) => p.id === a.patientId),
    c = s.records["Treatment Plans"].find((c) => c.id === a.courseId),
    config = treatmentConfig(s, a);
  if (!p || p.status === "Archived")
    errors.push("Select an active registered patient.");
  if (!a.date || safeDate(a.date) !== a.date || a.date < DEMO_DATE)
    errors.push("Choose a valid date on or after the clinic operating day.");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(a.time))
    errors.push("Choose a valid time in Asia/Kolkata.");
  if (
    !Number.isInteger(a.duration) ||
    a.duration! < 5 ||
    a.duration! > 480 ||
    minutes(a.time) + a.duration! > 1440
  )
    errors.push("Duration must be 5–480 minutes and end on the same day.");
  if (!a.treatment.trim() || !a.doctor.trim())
    errors.push("Select treatment and doctor.");
  if (
    a.courseId &&
    (!c || c.patientId !== a.patientId || c.status !== "Active")
  )
    errors.push("Select an active course belonging to this patient.");
  if (
    c &&
    ((a.sitting || 0) !== (c.completedSittings || 0) + 1 ||
      (c.completedSittings || 0) >= (c.totalSittings || 0))
  )
    errors.push("Book the next unconsumed course sitting.");
  if (
    c &&
    s.appointments.some(
      (v) =>
        v.id !== a.id &&
        v.courseId === c.id &&
        v.sitting === a.sitting &&
        activeBooking(v) &&
        v.status !== "Completed",
    )
  )
    errors.push(
      "This course sitting already has a visit. Open or reschedule that appointment.",
    );
  if (a.status !== "Waiting list") {
    const doctorError = staffRestriction(s, a.doctor, "Doctor"),
      techError = staffRestriction(s, a.technician || "", "Laser Technician");
    if (doctorError) errors.push(doctorError);
    if (techError) errors.push(techError);
    if (!a.room?.trim() || !a.technician || a.technician === "Not assigned")
      errors.push("Assign an available room and technician.");
    if (config?.machineIds.length && !a.machineId)
      errors.push("Select a compatible machine for this treatment.");
    const room = roomFor(s, a.room || "");
    if (s.records["Rooms & Resources"]?.length && !room)
      errors.push("Choose a registered clinic room.");
    const roomError = roomRestriction(s, a.room || "");
    if (roomError) errors.push(roomError);
    if (a.machineId) {
      const machineError = machineRestriction(s, a.machineId);
      if (machineError) errors.push(machineError);
    }
    const m = s.records["Machines & Equipment"].find(
      (m) => m.id === a.machineId,
    );
    if (a.machineId && !m) errors.push("Choose an existing machine.");
    if (m && ["Maintenance", "Offline", "Out of service"].includes(m.status))
      errors.push(m.name + " is under maintenance or unavailable.");
    if (m && config && !config.machineIds.includes(m.id))
      errors.push(
        m.name + " is incompatible with this clinic treatment configuration.",
      );
    const conflicts = s.appointments.filter(
      (v) =>
        v.id !== a.id &&
        activeBooking(v) &&
        v.date === a.date &&
        minutes(v.time) < minutes(a.time) + a.duration! &&
        minutes(v.time) + (v.duration || 45) > minutes(a.time),
    );
    for (const v of conflicts) {
      const resources = [
        v.patientId === a.patientId ? "Patient" : "",
        v.doctor === a.doctor ? "Doctor " + a.doctor : "",
        v.technician && v.technician === a.technician
          ? "Technician " + a.technician
          : "",
        v.room && v.room === a.room ? "Room " + a.room : "",
        v.machineId && v.machineId === a.machineId ? "Machine " + m?.name : "",
      ].filter(Boolean);
      if (resources.length)
        errors.push(
          resources.join(", ") +
            " already has a visit " +
            v.time +
            "–" +
            clock(minutes(v.time) + (v.duration || 45)) +
            " (" +
            v.id +
            ").",
        );
    }
  }
  return errors;
}
export function clock(n: number) {
  return (
    String(Math.floor(n / 60)).padStart(2, "0") +
    ":" +
    String(n % 60).padStart(2, "0")
  );
}
export function alternatives(s: ClinicState, a: Appointment) {
  const result: Appointment[] = [];
  for (let day = 0; day < 4 && result.length < 4; day++)
    for (let n = 540; n <= 1080 && result.length < 4; n += 30) {
      const v = {
        ...a,
        date: addDays(safeDate(a.date), day),
        time: clock(n),
      };
      if (!bookingErrors(s, v).length) result.push(v);
    }
  return result;
}
