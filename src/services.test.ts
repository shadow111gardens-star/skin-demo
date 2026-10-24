import {
  reviewReady,
  sessionRecord,
  clinician,
} from "./features/sessions/testFixtures";
import { completeSession } from "./features/sessions/services";
import { safeDate, bookingConflict } from "./services";
import { describe, it, expect, beforeEach } from "vitest";
import { resetState, readState, saveState, DEMO_DATE } from "./data";
import { dashboardStats, recordPayment, followupStatus } from "./services";
import { readSession, saveSession, visibleModules } from "./auth";
describe("connected demo data", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  it("calculates Dashboard metrics from linked records", () => {
    const s = resetState();
    const metrics = dashboardStats(s, DEMO_DATE);
    expect(metrics).toEqual({
      appointments: 6,
      laser: 2,
      checkedIn: 1,
      followups: 1,
      overdue: 2,
      courses: 2,
      collections: 42000,
      outstanding: 24000,
    });
    expect(
      s.appointments.every((a) => s.patients.some((p) => p.id === a.patientId)),
    ).toBe(true);
  });
  it("updates date-specific data without inventing totals", () => {
    const s = resetState();
    expect(dashboardStats(s, "2026-10-24").appointments).toBe(1);
    expect(dashboardStats(s, "2026-10-24").collections).toBe(0);
    expect(followupStatus(s.records["Follow-ups"][1], "2026-10-24")).toBe(
      "Overdue",
    );
  });
  it("settles an invoice and updates collections consistently", () => {
    const s = resetState();
    const invoice = s.records["Packages & Billing"].find(
      (r) => r.status === "Pending",
    )!;
    const updated = recordPayment(
      s,
      invoice.patientId!,
      invoice.amount,
      DEMO_DATE,
      invoice.id,
    );
    expect(dashboardStats(updated, DEMO_DATE).outstanding).toBe(0);
    expect(dashboardStats(updated, DEMO_DATE).collections).toBe(66000);
    expect(updated.records["Payments"][0].patientId).toBe(invoice.patientId);
  });
  it("persists records and upgrades old state without discarding patients", () => {
    const s = resetState();
    s.clinicName = "My fictional clinic";
    s.schemaVersion = 2;
    saveState(s);
    const restored = readState();
    expect(restored.schemaVersion).toBe(3);
    expect(restored.clinicName).toBe("My fictional clinic");
    expect(restored.patients).toEqual(s.patients);
    expect(new Set(restored.appointments.map((a) => a.id)).size).toBe(
      restored.appointments.length,
    );
  });
  it("stores role preferences but never passwords", () => {
    saveSession(
      { role: "Doctor", email: "doctor@example.test", name: "Dr. Mehta" },
      true,
    );
    expect(readSession()?.role).toBe("Doctor");
    expect(localStorage.getItem("mmverse-role")).toBe("Doctor");
    expect(localStorage.getItem("mmverse-session")).not.toContain("password");
    expect(visibleModules("Laser Technician")).not.toContain("Payments");
    expect(visibleModules("Clinic Owner")).toBeNull();
  });
});
it("completes linked sittings and advances a course exactly once", () => {
  const s = reviewReady();
  const next = completeSession(s, sessionRecord(s).id, clinician, "Reviewed");
  expect(
    next.records["Treatment Plans"].find((r) => r.id === "course-MM-1041")
      ?.completedSittings,
  ).toBe(5);
  expect(next.patients[0].lastVisit).toBe("23 Oct 2026");
  expect(
    completeSession(next, sessionRecord(next).id, clinician, "Repeated"),
  ).toBe(next);
});
it("detects overlapping visits for shared clinic resources", () => {
  const s = resetState();
  const appointment = { ...s.appointments[0], id: "new-visit", time: "09:45" };
  expect(bookingConflict(s, appointment)?.id).toBe("APT-201");
  expect(bookingConflict(s, { ...appointment, time: "14:00" })).toBeUndefined();
});
it("handles invalid date query values with the demo date", () => {
  expect(safeDate("not-a-date")).toBe(DEMO_DATE);
  expect(safeDate("2026-02-31")).toBe(DEMO_DATE);
  expect(safeDate("2026-10-24")).toBe("2026-10-24");
});
it("preserves patient links when an older store has newly registered patients at the front", () => {
  const s = resetState();
  s.schemaVersion = 2;
  s.patients.unshift({
    ...s.patients[0],
    id: "MM-NEW",
    name: "New Demo Patient",
  });
  saveState(s);
  const upgraded = readState();
  expect(upgraded.patients[0].id).toBe("MM-NEW");
  expect(upgraded.appointments.find((a) => a.id === "APT-206")?.patientId).toBe(
    "MM-1041",
  );
  expect(
    upgraded.records["Treatment Plans"].find((r) => r.id === "course-MM-1041")
      ?.patientId,
  ).toBe("MM-1041");
});
