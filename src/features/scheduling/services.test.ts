import { describe, it, expect, beforeEach } from "vitest";
import { resetState, DEMO_DATE, type Appointment } from "../../data";
import { addDays, dashboardStats } from "../../services";
import {
  bookingErrors,
  alternatives,
  saveAppointment,
  appointmentAction,
  followupRows,
  inFollowupTab,
  contactAction,
  reminderPaused,
  reminderText,
  suggestedDate,
} from "./services";
import { materializeFollowups } from "./followupLogic";
const booking = (s = resetState()): Appointment => ({
  ...s.appointments.find((a) => a.id === "APT-204")!,
  id: "new-booking",
  patientId: "MM-1046",
  courseId: undefined,
  treatment: "Chemical Peel",
  doctor: "Dr. Mehta",
  technician: "Neha Rao",
  room: "Room 03",
  machineId: undefined,
  duration: 45,
  date: DEMO_DATE,
  time: "14:00",
  sitting: 1,
  totalSittings: 1,
  status: "Confirmed",
  bookingSource: "Clinic desk",
  notes: "Fictional booking",
});
beforeEach(() => localStorage.clear());
describe("shared schedule integrity", () => {
  it("creates one connected appointment/session and edits the same identity without consuming a unit", () => {
    const s = resetState(),
      a = booking(s),
      next = saveAppointment(s, a, "Reception", "Patient request");
    expect(next.appointments.filter((v) => v.id === a.id)).toHaveLength(1);
    const session = next.records["Sittings & Sessions"].find(
      (r) => r.appointmentId === a.id,
    )!;
    expect(session.patientId).toBe(a.patientId);
    expect(session.session!.parameters).toEqual({});
    const edit = saveAppointment(
      next,
      { ...a, time: "15:00", room: "Room 02", notes: "Updated room" },
      "Reception",
      "Requested later slot",
    );
    expect(edit.appointments.find((v) => v.id === a.id)?.time).toBe("15:00");
    expect(
      edit.records["Sittings & Sessions"].find((r) => r.id === session.id)
        ?.session,
    ).toMatchObject({ time: "15:00", room: "Room 02" });
    expect(edit.sessionCompletions).toEqual(s.sessionCompletions);
    expect(edit.records["Treatment Plans"]).toEqual(
      s.records["Treatment Plans"],
    );
    expect(
      edit.appointments.find((v) => v.id === a.id)?.audit?.map((e) => e.action),
    ).toEqual(["Booking created", "Rescheduled", "Booking updated"]);
  });
  it("detects overlapping patients, doctors, technicians, rooms and machines and offers valid alternatives", () => {
    const s = resetState(),
      a = {
        ...s.appointments.find((a) => a.id === "APT-206")!,
        id: "conflict",
        courseId: undefined,
        time: "09:45",
      };
    const errors = bookingErrors(s, a).join(" ");
    for (const part of [
      "Patient",
      "Doctor",
      "Technician",
      "Room",
      "Machine",
      "APT-201",
    ])
      expect(errors).toContain(part);
    expect(() => saveAppointment(s, a, "Reception", "Request")).toThrow(
      "already has a visit",
    );
    const slots = alternatives(s, a);
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) expect(bookingErrors(s, slot)).toEqual([]);
    expect(
      bookingErrors(s, { ...a, time: "10:15" }).some((e) =>
        e.includes("APT-201"),
      ),
    ).toBe(false);
  });
  it("rejects maintenance and incompatible machines across booking and edit paths", () => {
    const s = resetState(),
      a = { ...s.appointments.find((a) => a.id === "APT-206")!, time: "14:00" };
    s.records["Machines & Equipment"].find(
      (m) => m.id === a.machineId,
    )!.status = "Maintenance";
    expect(bookingErrors(s, a).join(" ")).toContain("maintenance");
    expect(() => saveAppointment(s, a, "Reception", "Move")).toThrow(
      "maintenance",
    );
    expect(alternatives(s, a)).toEqual([]);
    a.machineId = s.records["Machines & Equipment"].find(
      (m) => m.id !== a.machineId,
    )!.id;
    expect(bookingErrors(s, a).join(" ")).toContain("incompatible");
  });
  it("checks duration boundaries, valid dates, course ownership and existing course sitting bookings", () => {
    const s = resetState(),
      a = booking(s);
    expect(bookingErrors(s, { ...a, duration: 0 }).join()).toContain(
      "Duration",
    );
    expect(bookingErrors(s, { ...a, date: "2026-02-31" }).join()).toContain(
      "valid date",
    );
    expect(
      bookingErrors(s, { ...a, time: "23:45", duration: 45 }).join(),
    ).toContain("same day");
    expect(
      bookingErrors(s, { ...a, courseId: "course-MM-1041" }).join(),
    ).toContain("belonging");
    const duplicate = {
      ...s.appointments.find((a) => a.id === "APT-206")!,
      id: "duplicate",
    };
    expect(bookingErrors(s, duplicate).join()).toContain("already has a visit");
  });
  it("retains identity and package balances for no-show, cancellation and reschedule; missed follow-ups reflect attendance", () => {
    const s = resetState(),
      id = "APT-206",
      before = s.records["Treatment Plans"].find(
        (c) => c.id === "course-MM-1041",
      )!.completedSittings;
    const missed = materializeFollowups(
      appointmentAction(
        s,
        id,
        "No-show",
        "Patient did not attend",
        "Reception",
      ),
    );
    expect(
      missed.records["Follow-ups"].find((f) => f.id === "missed-" + id),
    ).toBeDefined();
    expect(missed.sessionCompletions).toHaveLength(0);
    const a = missed.appointments.find((a) => a.id === id)!;
    const moved = materializeFollowups(
      saveAppointment(
        missed,
        { ...a, date: "2026-10-24", time: "16:00", status: "Confirmed" },
        "Reception",
        "New slot requested",
      ),
    );
    expect(moved.appointments.find((v) => v.id === id)?.date).toBe(
      "2026-10-24",
    );
    expect(
      moved.records["Follow-ups"].find((f) => f.id === "missed-" + id)?.status,
    ).toBe("Completed");
    expect(
      moved.records["Treatment Plans"].find((c) => c.id === "course-MM-1041")!
        .completedSittings,
    ).toBe(before);
    const cancelled = appointmentAction(
      moved,
      id,
      "Cancelled",
      "Patient request",
      "Reception",
    );
    expect(cancelled.appointments.find((a) => a.id === id)?.status).toBe(
      "Cancelled",
    );
    expect(cancelled.sessionCompletions).toHaveLength(0);
    expect(cancelled.records["Payments"]).toEqual(s.records["Payments"]);
  });
  it("allocates a waiting-list entry without reserving a resource before allocation", () => {
    const s = resetState(),
      a = {
        ...booking(s),
        id: "wait",
        time: "10:00",
        status: "Waiting list",
        room: undefined,
        technician: undefined,
      };
    const waiting = saveAppointment(s, a, "Reception", "No suitable time yet");
    expect(
      waiting.records["Sittings & Sessions"].some(
        (r) => r.appointmentId === a.id,
      ),
    ).toBe(false);
    const allocated = saveAppointment(
      waiting,
      {
        ...a,
        time: "14:00",
        status: "Confirmed",
        room: "Room 03",
        technician: "Neha Rao",
      },
      "Reception",
      "Available slot accepted",
    );
    expect(allocated.appointments.filter((v) => v.id === "wait")).toHaveLength(
      1,
    );
    expect(
      allocated.records["Sittings & Sessions"].find(
        (r) => r.appointmentId === "wait",
      )?.status,
    ).toBe("Scheduled");
  });
  it("reschedules against the newly selected resources rather than rejecting a replaced unavailable machine", () => {
    const s = resetState(),
      a = s.appointments.find((a) => a.id === "APT-204")!;
    s.records["Machines & Equipment"].find(
      (m) => m.id === a.machineId,
    )!.status = "Maintenance";
    // Configure a second compatible resource explicitly in the clinic catalogue.
    const replacement = s.records["Machines & Equipment"].find(
      (m) => m.id !== a.machineId,
    )!;
    s.records["Treatment Catalogue"]
      .find((t) => t.name === "HydraFacial")!
      .treatment!.machineIds.push(replacement.id);
    const next = saveAppointment(
      s,
      { ...a, date: "2026-10-24", time: "16:00", machineId: replacement.id },
      "Reception",
      "Use the available compatible resource",
    );
    expect(next.appointments.find((v) => v.id === a.id)?.machineId).toBe(
      replacement.id,
    );
    expect(
      next.records["Sittings & Sessions"].find((r) => r.appointmentId === a.id)
        ?.session!.machineId,
    ).toBe(replacement.id);
  });

  it("prevents edits after clinical work starts", () => {
    const s = resetState(),
      a = s.appointments.find((a) => a.status === "In progress")!;
    expect(() =>
      saveAppointment(s, { ...a, time: "15:00" }, "Reception", "Move"),
    ).toThrow("Clinical work has started");
  });
});
describe("follow-up dates, contacts and reminders", () => {
  it("uses the clinician-approved interval as a suggestion and updates due filters after an explicit override", () => {
    let s = resetState();
    const r = {
      id: "interval-review",
      name: "Ananya Sharma",
      patientId: "MM-1041",
      courseId: "course-MM-1041",
      date: DEMO_DATE,
      dueDate: DEMO_DATE,
      status: "Due today",
      detail: "Routine clinic review",
      amount: 0,
    };
    s.records["Follow-ups"].push(r);
    const c = s.records["Treatment Plans"].find((c) => c.id === r.courseId)!;
    c.course!.lastCompletedDate = "2026-10-20";
    const prior = s.records["Sittings & Sessions"].find(
      (v) => v.patientId === r.patientId && v.status === "Completed",
    );
    if (prior) prior.date = "2026-10-20";
    const expected = prior
      ? addDays("2026-10-20", c.course!.intervalDays)
      : r.dueDate;
    expect(suggestedDate(s, r)).toBe(expected);
    s = contactAction(
      s,
      r.id,
      "Override recommended date",
      "Clinician approved another date",
      "Dr. Mehta",
      "2026-10-26",
    );
    const updated = followupRows(s, DEMO_DATE).find((f) => f.id === r.id)!;
    expect(inFollowupTab(s, updated, "Due Soon", DEMO_DATE)).toBe(true);
    expect(updated.followup?.dateOverridden).toBe(true);
    expect(
      followupRows(s, "2026-10-27").find((f) => f.id === r.id)?.status,
    ).toBe("Overdue");
  });
  it("records contacts and resolved/declined outcomes without claiming message delivery", () => {
    const s = resetState(),
      r = s.records["Follow-ups"][0];
    const called = contactAction(
      s,
      r.id,
      "Call",
      "No answer; call attempt documented",
      "Riya Malhotra",
    );
    expect(called.records["Follow-ups"][0].followup?.contacts[0]).toMatchObject(
      { action: "Call", note: "No answer; call attempt documented" },
    );
    const done = contactAction(
      called,
      r.id,
      "Mark Resolved",
      "Patient confirmed next action",
      "Riya Malhotra",
    );
    expect(done.records["Follow-ups"][0].status).toBe("Completed");
    expect(done.records["Follow-ups"][0].followup?.contacts).toHaveLength(2);
    expect(() =>
      contactAction(done, r.id, "Call", "Again", "Riya Malhotra"),
    ).toThrow("closed");
    const declined = contactAction(
      s,
      r.id,
      "Record Declined",
      "Patient declined this contact",
      "Riya Malhotra",
    );
    expect(declined.records["Follow-ups"][0].status).toBe("Declined");
  });
  it("pauses routine drafts for paused courses and reaction reviews, including declined reaction contact", () => {
    const s = resetState(),
      r = s.records["Follow-ups"].find((f) => !!f.courseId)!;
    s.records["Treatment Plans"].find((c) => c.id === r.courseId)!.status =
      "Paused";
    expect(reminderPaused(s, r)).toBe(true);
    expect(() =>
      contactAction(
        s,
        r.id,
        "Draft WhatsApp Reminder",
        "Draft only",
        "Riya Malhotra",
      ),
    ).toThrow("paused");
    s.records["Treatment Plans"].find((c) => c.id === r.courseId)!.status =
      "Active";
    const escalated = contactAction(
      s,
      r.id,
      "Escalate to Doctor",
      "Reaction concern handed to doctor",
      "Dr. Mehta",
    );
    expect(reminderPaused(escalated, r)).toBe(true);
    const declined = contactAction(
      escalated,
      r.id,
      "Record Declined",
      "Patient declined a call",
      "Riya Malhotra",
    );
    expect(declined.records["Follow-ups"][0].status).not.toBe("Declined");
    expect(reminderPaused(declined, r)).toBe(true);
    expect(() =>
      contactAction(
        declined,
        r.id,
        "Mark Resolved",
        "Reviewed",
        "Riya Malhotra",
      ),
    ).toThrow("clinician");
    const resolved = contactAction(
      declined,
      r.id,
      "Mark Resolved",
      "Doctor reviewed",
      "Dr. Mehta",
    );
    expect(reminderPaused(resolved, r)).toBe(false);
  });
  it("keeps routine reminder copy free of patient identifiers, treatment and medical details", () => {
    const s = resetState(),
      r = s.records["Follow-ups"][0],
      text = reminderText(s, r);
    expect(text).toContain(s.clinicName);
    expect(text).not.toContain(r.patientId!);
    expect(text).not.toContain(r.detail);
    expect(text).not.toMatch(/laser|reaction|PRP|diagnosis|pigmentation/i);
  });
  it("links scheduled appointments to the same follow-up and refreshes dashboard counts", () => {
    const s = resetState(),
      r =
        s.records["Follow-ups"].find((f) => f.patientId === "MM-1046") ||
        s.records["Follow-ups"][0],
      a = { ...booking(s), patientId: r.patientId!, date: "2026-10-25" };
    const next = saveAppointment(
      s,
      a,
      "Reception",
      "Follow-up requested",
      r.id,
    );
    expect(
      next.records["Follow-ups"].find((f) => f.id === r.id)?.appointmentId,
    ).toBe(a.id);
    const old = dashboardStats(s, DEMO_DATE).followups,
      done = contactAction(
        next,
        r.id,
        "Mark Resolved",
        "Visit arranged",
        "Dr. Mehta",
      );
    expect(dashboardStats(done, DEMO_DATE).followups).toBeLessThanOrEqual(old);
  });
  it("derives expiry, completion, inactive and post-treatment work once with stable identities", () => {
    let s = resetState();
    const c = s.records["Treatment Plans"].find((c) => c.status === "Active")!;
    c.course!.validUntil = "2026-10-28";
    s.patients[5].status = "Inactive";
    s = materializeFollowups(s);
    const twice = materializeFollowups(s);
    expect(new Set(twice.records["Follow-ups"].map((f) => f.id)).size).toBe(
      twice.records["Follow-ups"].length,
    );
    expect(
      twice.records["Follow-ups"].some((f) => f.id === "expiry-" + c.id),
    ).toBe(true);
    expect(
      twice.records["Follow-ups"].some(
        (f) => f.followupKind === "Course Completion",
      ),
    ).toBe(true);
    expect(
      twice.records["Follow-ups"].some(
        (f) => f.followupKind === "Inactive Patient",
      ),
    ).toBe(true);
  });
});
