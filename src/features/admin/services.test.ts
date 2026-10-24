import { beforeEach, describe, it, expect } from "vitest";
import { resetState, readState, saveState, DEMO_DATE } from "../../data";
import { configureMoney, formatINR } from "../../format";
import {
  saveSettingsSection,
  settingsForm,
  saveSchema,
} from "./settingsServices";
import { saveStaff } from "./staffServices";
import { clinicDoctors, quickContext, moduleForPath } from "./access";
import {
  globalSearch,
  clinicNotifications,
  notificationAction,
} from "./globalSelectors";
import { bookingErrors } from "../scheduling/availability";
import { reminderText } from "../scheduling/followupLogic";
import { recordConsent } from "../sessions/services";
import { sessionRecord } from "../sessions/testFixtures";
beforeEach(() => {
  localStorage.clear();
  configureMoney();
});
describe("local administration and global state", () => {
  it("seeds four demo roles and editable clinic defaults without changing existing record identities", () => {
    const s = resetState();
    expect(s.records["Staff & Roles"]).toHaveLength(6);
    expect(
      new Set(s.records["Staff & Roles"].map((r) => r.staff?.role)).size,
    ).toBe(4);
    expect(s.adminSettings?.profile.timezone).toBe("Asia/Kolkata");
    expect(s.adminSettings?.currency.code).toBe("INR");
    expect(s.adminSettings?.reminderTemplates).toHaveLength(3);
    expect(s.notificationState).toEqual({ read: {}, dismissed: {} });
    saveState(s);
    expect(readState().adminSettings).toEqual(s.adminSettings);
  });
  it("creates a doctor usable in booking and blocks unavailable staff without creating authentication accounts", () => {
    let s = resetState();
    const template = s.records["Staff & Roles"][0],
      record = {
        ...template,
        id: "staff-sia",
        name: "Dr. Sia Demo",
        staff: {
          ...template.staff!,
          role: "Doctor" as const,
          phone: "9000099988",
          email: "sia@example.test",
          availability: "Available" as const,
          previousNames: [],
        },
      };
    s = saveStaff(s, record);
    expect(clinicDoctors(s)).toContain("Dr. Sia Demo");
    const a = {
      ...s.appointments[0],
      id: "admin-booking",
      patientId: "MM-1046",
      doctor: record.name,
      technician: "Neha Rao",
      treatment: "Chemical Peel",
      room: "Room 04",
      time: "18:00",
      status: "Confirmed",
      courseId: undefined,
      machineId: undefined,
      date: DEMO_DATE,
      duration: 30,
      sitting: 1,
      totalSittings: 1,
    };
    expect(bookingErrors(s, a)).toEqual([]);
    s = saveStaff(s, {
      ...record,
      staff: { ...record.staff, availability: "On leave" },
    });
    expect(bookingErrors(s, a).join(" ")).toContain("unavailable or inactive");
    expect(() => saveStaff(s, { ...record, id: "duplicate" })).toThrow(
      /already assigned|unique staff/,
    );
  });
  it("renames current assignments but retains completed appointment signatures and aliases", () => {
    const s = resetState(),
      r = s.records["Staff & Roles"].find((r) => r.name === "Aarav Singh")!,
      next = saveStaff(s, { ...r, name: "Aarav Demo Singh" });
    expect(next.appointments.find((a) => a.id === "APT-206")?.technician).toBe(
      "Aarav Demo Singh",
    );
    expect(next.appointments.find((a) => a.id === "APT-201")?.technician).toBe(
      "Aarav Singh",
    );
    expect(
      next.records["Staff & Roles"].find((v) => v.id === r.id)?.staff
        ?.previousNames,
    ).toContain("Aarav Singh");
  });
  it("validates and persists clinic profile fields while retaining the IST scheduling convention", () => {
    const s = resetState(),
      v = settingsForm(s, "Clinic Profile", "").values,
      next = saveSettingsSection(s, "Clinic Profile", "", {
        ...v,
        name: "Demo Meridian Clinic",
        timezone: "Asia/Calcutta",
      });
    expect(next.clinicName).toBe("Demo Meridian Clinic");
    expect(next.adminSettings?.profile.timezone).toBe("Asia/Kolkata");
    expect(() =>
      saveSettingsSection(s, "Clinic Profile", "", { ...v, email: "invalid" }),
    ).toThrow(/valid Indian/);
    saveState(next);
    expect(readState().clinicName).toBe("Demo Meridian Clinic");
  });
  it("updates canonical treatment/default scheduling configuration without rewriting approved course intervals", () => {
    const s = resetState(),
      t = s.records["Treatment Catalogue"][0],
      courseBefore = structuredClone(s.records["Treatment Plans"]);
    let next = saveSettingsSection(s, "Treatment Intervals", t.id, {
      intervalDays: "35",
    });
    expect(next.records["Treatment Catalogue"][0].treatment?.intervalDays).toBe(
      35,
    );
    expect(next.records["Treatment Plans"]).toEqual(courseBefore);
    next = saveSettingsSection(next, "Appointment Durations", t.id, {
      duration: "50",
      defaultAppointmentMinutes: "40",
    });
    expect(next.records["Treatment Catalogue"][0].treatment?.duration).toBe(50);
    expect(next.adminSettings?.defaultAppointmentMinutes).toBe(40);
    expect(() =>
      saveSettingsSection(s, "Treatment Intervals", t.id, {
        intervalDays: "0",
      }),
    ).toThrow(/whole number/);
  });
  it("updates new-purchase package validity and currency presentation without changing purchased units or invoice amounts", () => {
    const s = resetState(),
      p = s.records["Package Catalogue"][0],
      before = structuredClone(s.records["Treatment Plans"]);
    let next = saveSettingsSection(s, "Package Validity", p.id, {
      validityDays: "365",
      defaultPackageDays: "270",
    });
    expect(
      next.records["Package Catalogue"][0].packageConfig?.validityDays,
    ).toBe(365);
    expect(next.records["Treatment Plans"]).toEqual(before);
    next = saveSettingsSection(next, "Currency", "", {
      locale: "en-GB",
      display: "code",
      minimumDigits: "2",
      maximumDigits: "2",
    });
    configureMoney(next.adminSettings?.currency);
    expect(formatINR(123456.5)).toContain("INR");
    expect(formatINR(123456.5)).toContain("123,456.50");
    expect(next.records["Packages & Billing"]).toEqual(
      s.records["Packages & Billing"],
    );
    expect(() =>
      saveSettingsSection(s, "Currency", "", {
        locale: "en-IN",
        display: "symbol",
        minimumDigits: "2",
        maximumDigits: "1",
      }),
    ).toThrow(/minimum decimals/);
    configureMoney();
  });
  it("renders saved privacy-conscious reminder defaults and rejects unsupported sensitive placeholders", () => {
    const s = resetState(),
      id = s.adminSettings!.defaultReminderId,
      v = settingsForm(s, "Reminder Templates", id).values,
      next = saveSettingsSection(s, "Reminder Templates", id, {
        ...v,
        body: "Hello {firstName} from {clinicName}; contact reception {date}.",
      }),
      f = s.records["Follow-ups"][0];
    expect(reminderText(next, f)).toContain(s.clinicName);
    expect(reminderText(next, f)).not.toContain(f.patientId!);
    expect(() =>
      saveSettingsSection(s, "Reminder Templates", id, {
        ...v,
        body: "Your {treatment} is due",
      }),
    ).toThrow(/supported reminder/);
  });
  it("keeps consent template edits separate from actual consent and snapshots the explicitly recorded document", () => {
    let s = resetState();
    const id = s.adminSettings!.defaultConsentId,
      v = settingsForm(s, "Consent Templates", id).values;
    const count = s.records["Clinical Documents"].length;
    s = saveSettingsSection(s, "Consent Templates", id, {
      ...v,
      body: "Fictional clinician discussion template v1",
    });
    expect(s.records["Clinical Documents"]).toHaveLength(count);
    const r = sessionRecord(s);
    s = recordConsent(
      s,
      r,
      "Dr. Mehta",
      "Patient discussion recorded in this fictional test",
    );
    const doc = s.records["Clinical Documents"].find(
      (d) => d.id === "consent-" + r.id,
    )!;
    expect(doc.documentTemplate?.content).toBe(
      "Fictional clinician discussion template v1",
    );
    s = saveSettingsSection(s, "Consent Templates", id, {
      ...v,
      body: "Fictional later template v2",
    });
    expect(
      s.records["Clinical Documents"].find((d) => d.id === doc.id)
        ?.documentTemplate?.content,
    ).toBe("Fictional clinician discussion template v1");
  });
  it("requires source/units/review confirmation for schemas and preserves historical session parameter snapshots", () => {
    const s = resetState(),
      id = s.records["Machines & Equipment"][0].id,
      before = structuredClone(s.records["Sittings & Sessions"]),
      config = {
        fields: [
          {
            id: "clinic-field",
            label: "Clinic documented field",
            unit: "documented test units",
            type: "number" as const,
            required: true,
          },
        ],
        source: "Fictional clinic verified document",
        configuredBy: "Dr. Mehta",
        version: 0,
      };
    expect(() => saveSchema(s, id, config, false)).toThrow(/Confirm/);
    let next = saveSchema(s, id, config, true);
    expect(
      next.records["Machines & Equipment"][0].deviceDocumentation?.fields,
    ).toHaveLength(1);
    expect(next.records["Sittings & Sessions"]).toEqual(before);
    next = saveSchema(next, id, { ...config, fields: [] }, true);
    expect(
      next.records["Machines & Equipment"][0].deviceDocumentation?.fields,
    ).toHaveLength(0);
    expect(
      next.records["Machines & Equipment"][0].deviceDocumentation?.version,
    ).toBe(2);
  });
  it("searches categorized patient IDs, normalized mobiles, actual booking identities and machine serials", () => {
    const s = resetState();
    expect(
      globalSearch(s, "+91 98765 43211", "Clinic Owner").some(
        (r) => r.group === "Patients" && r.id === "MM-1042",
      ),
    ).toBe(true);
    expect(
      globalSearch(s, "MM-1041", "Clinic Owner").some(
        (r) => r.group === "Treatment courses",
      ),
    ).toBe(true);
    expect(globalSearch(s, "APT-206", "Clinic Owner")[0].href).toContain(
      "appointment=APT-206",
    );
    expect(
      globalSearch(s, "DEMO-ASSET-001", "Clinic Owner").find(
        (r) => r.group === "Machines",
      )?.href,
    ).toBe("/machines-equipment/machines-equipment-1");
    expect(globalSearch(s, "xyz-no-results", "Clinic Owner")).toEqual([]);
    expect(globalSearch(s, "Payments", "Laser Technician")).toEqual([]);
  });
  it("persists notification read/dismiss state, re-surfaces changed stock and removes resolved source alerts", () => {
    let s = resetState();
    const n = clinicNotifications(s, "Clinic Owner").find(
        (n) => n.id === "stock-inventory-1",
      )!;
    expect(n.read).toBe(false);
    s = notificationAction(s, "read", [n], n.id);
    saveState(s);
    expect(
      clinicNotifications(readState(), "Clinic Owner").find(
        (v) => v.id === n.id,
      )?.read,
    ).toBe(true);
    s = notificationAction(
      s,
      "dismiss",
      clinicNotifications(s, "Clinic Owner"),
      n.id,
    );
    expect(
      clinicNotifications(s, "Clinic Owner").find((v) => v.id === n.id)
        ?.dismissed,
    ).toBe(true);
    s.records.Inventory[0].inventory!.quantity = 11;
    expect(
      clinicNotifications(s, "Clinic Owner").find((v) => v.id === n.id),
    ).toMatchObject({ read: false, dismissed: false });
    s.records.Inventory[0].inventory!.quantity = 20;
    expect(
      clinicNotifications(s, "Clinic Owner").some((v) => v.id === n.id),
    ).toBe(false);
  });
  it("respects notification category preferences and derives expiry alerts from actual course expiry", () => {
    let s = resetState();
    const v = settingsForm(s, "Notification Preferences", "").values;
    s.records["Treatment Plans"][0].course!.validUntil = "2026-10-28";
    expect(
      clinicNotifications(s, "Clinic Owner").some(
        (n) => n.category === "Expiring packages",
      ),
    ).toBe(true);
    s = saveSettingsSection(s, "Notification Preferences", "", {
      ...v,
      "Low stock": "no",
    });
    expect(
      clinicNotifications(s, "Clinic Owner").some(
        (n) => n.category === "Low stock",
      ),
    ).toBe(false);
  });
  it("resolves quick-create context and nested administration/finance modules consistently", () => {
    const s = resetState(),
      course = s.records["Treatment Plans"][0];
    expect(quickContext(s, "/patients/MM-1042", "").patientId).toBe("MM-1042");
    expect(
      quickContext(s, "/treatment-plans/courses/" + course.id, ""),
    ).toMatchObject({ patientId: course.patientId, courseId: course.id });
    expect(
      quickContext(s, "/appointments", "?appointment=APT-206"),
    ).toMatchObject({ patientId: "MM-1041", courseId: "course-MM-1041" });
    expect(moduleForPath("/invoices/packages-billing-1")).toBe(
      "Packages & Billing",
    );
    expect(moduleForPath("/clinic-settings")).toBe("Clinic Settings");
  });
});
