import { describe, it, expect, beforeEach } from "vitest";
import { resetState, saveState, readState, DEMO_DATE } from "../../data";
import { dashboardStats, completeAppointment } from "../../services";
import { ensureSession } from "./sessionData";
import {
  completeSession,
  transitionSession,
  saveSessionDraft,
  rescheduleSession,
  bookLinked,
  packageBalance,
  startErrors,
  configureDevice,
  savePolicy,
} from "./services";
import {
  clinician,
  sessionRecord,
  preparedSession,
  reviewReady,
} from "./testFixtures";
beforeEach(() => localStorage.clear());
describe("connected sitting lifecycle", () => {
  it("deducts one unit once, preserves charges, updates patient/course/follow-up/audit and persists", () => {
    const ready = reviewReady(),
      r = sessionRecord(ready),
      before = structuredClone(ready.records["Payments"]);
    const done = completeSession(
      ready,
      r.id,
      clinician,
      "Reviewed and confirmed",
    );
    expect(packageBalance(done, r)).toEqual({
      total: 6,
      used: 5,
      remaining: 1,
    });
    expect(
      done.records["Packages & Billing"].find((i) => i.courseId === r.courseId)
        ?.packageSessions,
    ).toEqual({ total: 6, used: 5, remaining: 1 });
    expect(done.records["Payments"]).toEqual(before);
    expect(done.sessionCompletions).toHaveLength(1);
    expect(done.sessionCompletions![0]).toMatchObject({
      sessionId: r.id,
      chargeAmount: 0,
      units: 1,
      packageBefore: 2,
      packageAfter: 1,
    });
    expect(completeSession(done, r.id, clinician, "Repeated click")).toBe(done);
    expect(done.patients.find((p) => p.id === r.patientId)?.lastVisit).toBe(
      "23 Oct 2026",
    );
    expect(
      done.records["Follow-ups"].find((f) => f.sessionId === r.id),
    ).toMatchObject({
      patientId: r.patientId,
      dueDate: "2026-11-20",
      status: "Scheduled",
    });
    expect(sessionRecord(done).session!.audit[0].action).toContain("completed");
    expect(
      done.activity.some(
        (a) => a.patientId === r.patientId && a.message.includes("completed"),
      ),
    ).toBe(true);
    saveState(done);
    expect(readState().sessionCompletions).toEqual(done.sessionCompletions);
  });
  it("moves through only permitted states and blocks missing preparation/consent/configuration", () => {
    const s = resetState(),
      r = sessionRecord(s);
    expect(() => transitionSession(s, r.id, "In Progress", clinician)).toThrow(
      "not permitted",
    );
    let next = transitionSession(s, r.id, "Checked In", clinician);
    next = transitionSession(next, r.id, "In Preparation", clinician);
    expect(() =>
      transitionSession(next, r.id, "In Progress", clinician),
    ).toThrow("consent");
    expect(startErrors(s, r).join(" ")).toContain(
      "no configured documentation fields",
    );
    expect(() => completeAppointment(s, "APT-206")).toThrow(
      "session workspace",
    );
  });
  it("requires clinician review and explicit confirmation; catches legacy progress duplicates", () => {
    const s = reviewReady(),
      r = sessionRecord(s);
    expect(() =>
      completeSession(
        s,
        r.id,
        { role: "Laser Technician", name: "Operator" },
        "Done",
      ),
    ).toThrow("Doctor");
    expect(() => completeSession(s, r.id, clinician, "")).toThrow(
      "Confirm completion",
    );
    const duplicate = structuredClone(s);
    sessionRecord(duplicate).session!.number = 4;
    expect(() => completeSession(duplicate, r.id, clinician, "Done")).toThrow(
      "already included",
    );
    const missing = structuredClone(s);
    sessionRecord(missing).session!.doctorReview = "";
    expect(() => completeSession(missing, r.id, clinician, "Done")).toThrow(
      "doctor review",
    );
  });
  it("does not consume package units when cancelled, no-show or rescheduled", () => {
    const s = resetState(),
      r = sessionRecord(s),
      before = packageBalance(s, r);
    const cancelled = transitionSession(
      s,
      r.id,
      "Cancelled",
      clinician,
      "Patient request",
    );
    const noShow = transitionSession(
      s,
      r.id,
      "No-show",
      clinician,
      "Did not arrive",
    );
    const moved = rescheduleSession(
      s,
      r.id,
      "2026-10-24",
      "16:00",
      "Patient request",
      "Receptionist",
    );
    for (const next of [cancelled, noShow, moved]) {
      expect(packageBalance(next, r)).toEqual(before);
      expect(next.sessionCompletions).toHaveLength(0);
      expect(next.records["Payments"]).toEqual(s.records["Payments"]);
      expect(sessionRecord(next).session!.audit.length).toBeGreaterThan(
        r.session!.audit.length,
      );
    }
    expect(sessionRecord(moved).date).toBe("2026-10-24");
    expect(sessionRecord(moved).session!.checks.identity).toBe(false);
    expect(() => completeSession(cancelled, r.id, clinician, "Done")).toThrow(
      "review",
    );
    expect(() =>
      rescheduleSession(s, r.id, "2026-02-31", "12:00", "Reason", "Actor"),
    ).toThrow("valid date");
  });
  it("escalates adverse reactions to review and resolves only that review after clinician completion", () => {
    let s = preparedSession();
    const id = sessionRecord(s).id;
    s = transitionSession(s, id, "Checked In", clinician);
    s = transitionSession(s, id, "In Preparation", clinician);
    s = transitionSession(s, id, "In Progress", clinician);
    const d = {
      ...sessionRecord(s).session!,
      procedureNotes: "Procedure stopped and documented",
      tolerance: "Patient report",
      response: "Response documented",
      reaction: "Observed" as const,
      reactionNotes: "Fictional observed reaction",
      escalationNote: "Dr. Mehta contacted",
      aftercare: "Clinician-entered aftercare",
      doctorReview: "Reaction reviewed by clinician",
    };
    s = saveSessionDraft(s, id, d, "Operator");
    expect(sessionRecord(s).status).toBe("Awaiting Review");
    expect(dashboardStats(s, DEMO_DATE).followups).toBe(2);
    expect(
      s.records["Follow-ups"].find((f) => f.id === "reaction-" + id)?.status,
    ).toBe("Due today");
    expect(() =>
      saveSessionDraft(
        s,
        id,
        { ...sessionRecord(s).session!, reaction: "None observed" },
        "Operator",
      ),
    ).toThrow("Retain");
    const done = completeSession(
      s,
      id,
      clinician,
      "Reviewed reaction and confirmed",
    );
    expect(
      done.records["Follow-ups"].find((f) => f.id === "reaction-" + id)?.status,
    ).toBe("Completed");
    expect(
      done.records["Follow-ups"].find((f) => f.id !== "reaction-" + id)?.status,
    ).not.toBe("Completed");
  });
  it("requires fresh parameter approval after editing values or changing device units", () => {
    let s = preparedSession(),
      r = sessionRecord(s);
    expect(startErrors(s, r)).toEqual([]);
    s = saveSessionDraft(
      s,
      r.id,
      { ...r.session!, parameters: { "test-energy": "13" } },
      "Operator",
    );
    expect(sessionRecord(s).session!.checks.parameters).toBe(false);
    s = preparedSession();
    r = sessionRecord(s);
    const m = s.records["Machines & Equipment"].find(
      (m) => m.id === r.session!.machineId,
    )!;
    s = configureDevice(
      s,
      m.id,
      { ...m.deviceDocumentation!, source: "New clinic documentation" },
      "Doctor",
    );
    expect(startErrors(s, sessionRecord(s)).join(" ")).toContain(
      "configuration changed",
    );
    expect(() =>
      saveSessionDraft(s, r.id, sessionRecord(s).session!, "Operator"),
    ).toThrow("Clear prior settings");
    s = saveSessionDraft(
      s,
      r.id,
      { ...sessionRecord(s).session!, parameters: {} },
      "Operator",
    );
    expect(sessionRecord(s).session!.checks.parameters).toBe(false);
  });
  it("links the next sitting once without copying settings; follow-up booking updates rather than duplicates", () => {
    const ready = reviewReady(),
      r = sessionRecord(ready),
      done = completeSession(ready, r.id, clinician, "Confirmed");
    const booked = bookLinked(
      done,
      r.id,
      "sitting",
      "2026-11-20",
      "14:30",
      "Clinic-approved date",
      "Dr. Mehta",
    );
    const next = booked.state.records["Sittings & Sessions"].find(
      (r) => r.id === booked.recordId,
    )!;
    expect(next.patientId).toBe(r.patientId);
    expect(next.courseId).toBe(r.courseId);
    expect(next.session!.number).toBe(6);
    expect(next.session!.parameters).toEqual({});
    expect(next.session!.checks.parameters).toBe(false);
    expect(packageBalance(booked.state, r)?.remaining).toBe(1);
    expect(() =>
      bookLinked(
        booked.state,
        r.id,
        "sitting",
        "2026-11-21",
        "14:30",
        "Again",
        "Dr. Mehta",
      ),
    ).toThrow(/already.*(booked|visit)/);
    const f = bookLinked(
      booked.state,
      r.id,
      "followup",
      "2026-11-21",
      "",
      "Updated review date",
      "Doctor",
    );
    expect(
      f.state.records["Follow-ups"].filter((v) => v.id === "aftercare-" + r.id),
    ).toHaveLength(1);
    expect(ensureSession(booked.state, next.appointmentId!).record.id).toBe(
      next.id,
    );
  });
  it("blocks future starts, mismatched consent, expired packages and occupied resources", () => {
    const s = preparedSession(),
      r = sessionRecord(s);
    r.session!.consentDocumentId = "wrong-patient";
    expect(startErrors(s, r).join(" ")).toContain("consent document");
    r.session!.consentDocumentId = "consent-" + r.id;
    s.records["Treatment Plans"].find(
      (c) => c.id === r.courseId,
    )!.course!.validUntil = "2026-01-01";
    expect(startErrors(s, r).join(" ")).toContain("expired");
    const future = preparedSession(resetState(), "APT-207"),
      fr = sessionRecord(future, "APT-207");
    const checked = transitionSession(future, fr.id, "Checked In", clinician),
      prep = transitionSession(checked, fr.id, "In Preparation", clinician);
    expect(() =>
      transitionSession(prep, fr.id, "In Progress", clinician),
    ).toThrow("future");
    expect(() =>
      rescheduleSession(
        resetState(),
        sessionRecord(resetState()).id,
        DEMO_DATE,
        "09:30",
        "Reason",
        "Actor",
      ),
    ).toThrow(/already.*(booked|visit)/);
  });
  it("requires owner role for policy and clinician role for verified device schemas", () => {
    const s = resetState();
    expect(() => savePolicy(s, s.sessionPolicy!, "Receptionist")).toThrow(
      "Owner",
    );
    expect(() =>
      configureDevice(
        s,
        "none",
        { fields: [], source: "", configuredBy: "", version: 0 },
        "Laser Technician",
      ),
    ).toThrow();
  });
  it("finishes the final qualifying sitting without clearing an outstanding invoice", () => {
    const first = reviewReady(),
      r = sessionRecord(first),
      done = completeSession(first, r.id, clinician, "Reviewed");
    const last = structuredClone(done),
      visit = last.appointments.find((a) => a.id === "APT-206")!;
    last.records["Packages & Billing"].find(
      (i) => i.courseId === r.courseId,
    )!.status = "Pending";
    last.records["Packages & Billing"].find(
      (i) => i.courseId === r.courseId,
    )!.amount = 1000;
    last.appointments.push({
      ...visit,
      id: "last-sitting",
      time: "18:00",
      sitting: 6,
      status: "Confirmed",
    });
    const ready = reviewReady(last, "last-sitting"),
      completed = completeSession(
        ready,
        sessionRecord(ready, "last-sitting").id,
        clinician,
        "Final sitting reviewed",
      );
    expect(packageBalance(completed, r)).toEqual({
      total: 6,
      used: 6,
      remaining: 0,
    });
    expect(
      completed.records["Treatment Plans"].find((c) => c.id === r.courseId),
    ).toMatchObject({
      status: "Completed",
      course: { completionConfirmed: false },
    });
    expect(
      completed.records["Packages & Billing"].find(
        (i) => i.courseId === r.courseId,
      ),
    ).toMatchObject({
      status: "Pending",
      amount: 1000,
      packageSessions: { remaining: 0 },
    });
    expect(completed.sessionCompletions).toHaveLength(2);
  });
});
