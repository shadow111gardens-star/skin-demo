import {
  reviewReady,
  sessionRecord,
  clinician,
} from "../sessions/testFixtures";
import { completeSession } from "../sessions/services";
import { describe, it, expect } from "vitest";
import { resetState } from "../../data";
import { completeAppointment, recordPayment } from "../../services";
import { enrichClinicalState } from "./clinicalData";
import { estimate } from "./model";
import {
  savePlan,
  transitionPlan,
  convertPlan,
  changeCourseStatus,
  courseBalance,
  saveConsultation,
  reviewConsultation,
  saveTreatment,
} from "./services";
describe("connected clinical integrity", () => {
  it("migrates ten configurable treatments and keeps existing course IDs and patient records", () => {
    const s = resetState();
    expect(s.records["Treatment Catalogue"]).toHaveLength(10);
    expect(s.records["Treatment Plans"].map((r) => r.id)).toContain(
      "course-MM-1041",
    );
    expect(s.patients).toHaveLength(6);
    expect(enrichClinicalState(s)).toBe(s);
    expect(
      s.records["Plan Proposals"].filter(
        (p) => p.status === "Converted to Course",
      ),
    ).toHaveLength(3);
  });
  it("derives individual and prorated package estimates from the displayed configuration", () => {
    const p = resetState().records["Plan Proposals"].find(
      (p) => p.id === "proposal-MM-1043",
    )!.plan!;
    expect(estimate(p)).toBe(6480);
    expect(estimate({ ...p, sessions: 5 })).toBe(8100);
    expect(estimate({ ...p, sessions: 5, pricing: "individual" })).toBe(9000);
  });
  it("saves partial consultation drafts but validates submission and requires explicit clinician review", () => {
    const s = resetState(),
      r = s.records.Consultations.find((c) => c.status === "Draft")!;
    expect(
      saveConsultation(s, r).records.Consultations.find((c) => c.id === r.id)
        ?.status,
    ).toBe("Draft");
    expect(() =>
      saveConsultation(s, { ...r, status: "Awaiting Review" }),
    ).toThrow("Complete concern");
    const reviewed = s.records.Consultations.find(
      (c) => c.status === "Reviewed",
    )!;
    const awaiting = {
      ...reviewed,
      id: "new-consult",
      status: "Awaiting Review",
    };
    const next = saveConsultation(s, awaiting);
    expect(() =>
      reviewConsultation(next, awaiting.id, "Dr. Mehta", ""),
    ).toThrow("review note");
    expect(
      reviewConsultation(
        next,
        awaiting.id,
        "Dr. Mehta",
        "Reviewed source history",
      ).records.Consultations[0].status,
    ).toBe("Reviewed");
  });
  it("saves plan drafts without creating a course, rejects cross-patient assessments and unreviewed approval", () => {
    const s = resetState(),
      r = s.records["Plan Proposals"].find((p) => p.id === "proposal-MM-1043")!;
    const draft = { ...r, id: "draft-test", status: "Draft" };
    expect(savePlan(s, draft).records["Treatment Plans"]).toHaveLength(3);
    expect(() =>
      savePlan(s, {
        ...draft,
        patientId: "MM-1042",
        status: "Awaiting Approval",
      }),
    ).toThrow("assessment");
    const unreviewed = structuredClone(s);
    unreviewed.records.Consultations.find(
      (c) => c.id === r.plan?.consultationId,
    )!.status = "Draft";
    expect(() =>
      transitionPlan(unreviewed, r.id, "Approved", "Dr. Mehta"),
    ).toThrow("requires clinician review");
  });
  it("requires decline reasons, supports revised drafts and records approval decisions", () => {
    const s = resetState(),
      id = "proposal-MM-1043";
    expect(() => transitionPlan(s, id, "Declined", "Dr. Mehta", "")).toThrow(
      "reason",
    );
    const declined = transitionPlan(
      s,
      id,
      "Declined",
      "Dr. Mehta",
      "Confirm clinical documentation",
    );
    expect(
      declined.records["Plan Proposals"].find((p) => p.id === id)?.status,
    ).toBe("Declined");
    const revised = savePlan(declined, {
      ...declined.records["Plan Proposals"].find((p) => p.id === id)!,
      status: "Awaiting Approval",
    });
    expect(
      transitionPlan(
        revised,
        id,
        "Approved",
        "Dr. Mehta",
        "Patient-specific configuration reviewed",
      ).records["Plan Proposals"].find((p) => p.id === id)?.plan?.approvalNote,
    ).toContain("Patient-specific");
  });
  it("converts only approved plans into exactly one course and invoice without duplicating a patient", () => {
    const s = resetState(),
      id = "proposal-MM-1043";
    expect(() => convertPlan(s, id)).toThrow("Approve");
    const approved = transitionPlan(s, id, "Approved", "Dr. Mehta");
    const converted = convertPlan(approved, id),
      course = converted.records["Treatment Plans"].find(
        (c) => c.course?.planId === id,
      )!;
    expect(course.completedSittings).toBe(0);
    expect(course.course?.assignedDoctor).toBe(
      approved.records["Plan Proposals"].find((p) => p.id === id)?.plan?.doctor,
    );
    expect(course.totalSittings).toBe(4);
    expect(courseBalance(converted, course)).toBe(6480);
    expect(convertPlan(converted, id)).toBe(converted);
    expect(converted.patients).toHaveLength(6);
    expect(
      converted.records["Packages & Billing"].filter(
        (i) => i.courseId === course.id,
      ),
    ).toHaveLength(1);
  });
  it("keeps approved price snapshots when catalogue defaults change", () => {
    const s = resetState(),
      p = s.records["Plan Proposals"].find((r) => r.id === "proposal-MM-1043")!,
      t = s.records["Treatment Catalogue"].find(
        (t) => t.id === p.plan?.treatmentId,
      )!;
    const next = saveTreatment(s, {
      ...t,
      treatment: { ...t.treatment!, packagePrice: 10000, intervalDays: 45 },
    });
    expect(
      estimate(
        next.records["Plan Proposals"].find((r) => r.id === p.id)!.plan!,
      ),
    ).toBe(6480);
    expect(() =>
      saveTreatment(s, { ...t, treatment: { ...t.treatment!, sessions: 0 } }),
    ).toThrow("whole number");
  });
  it("preserves completed care when pausing/cancelling and never consumes cancelled or rescheduled visits", () => {
    const s = resetState(),
      id = "course-MM-1041";
    const paused = changeCourseStatus(
      s,
      id,
      "Paused",
      "Patient requested a pause",
    );
    expect(() => completeAppointment(paused, "APT-206")).toThrow(
      "session workspace",
    );
    const active = changeCourseStatus(
      paused,
      id,
      "Active",
      "Clinician agreed to resume",
    );
    const cancelled = changeCourseStatus(
      active,
      id,
      "Cancelled",
      "Patient request",
    );
    expect(cancelled.appointments.find((a) => a.id === "APT-201")?.status).toBe(
      "Completed",
    );
    expect(cancelled.appointments.find((a) => a.id === "APT-206")?.status).toBe(
      "Cancelled",
    );
    expect(completeAppointment(cancelled, "APT-206")).toBe(cancelled);
    expect(
      cancelled.records["Treatment Plans"].find((c) => c.id === id)
        ?.completedSittings,
    ).toBe(4);
    const rescheduled = structuredClone(s);
    rescheduled.appointments.find((a) => a.id === "APT-206")!.status =
      "Rescheduled";
    expect(completeAppointment(rescheduled, "APT-206")).toBe(rescheduled);
    expect(() =>
      changeCourseStatus(s, id, "Completed", "Course complete"),
    ).toThrow("all planned sessions");
  });
  it("updates progress once and derives balances from linked payments", () => {
    const s = resetState(),
      id = "proposal-MM-1043";
    const next = convertPlan(
        transitionPlan(s, id, "Approved", "Dr. Mehta"),
        id,
      ),
      r = next.records["Treatment Plans"].find((c) => c.course?.planId === id)!;
    next.appointments.push({
      id: "course-visit",
      patientId: r.patientId!,
      courseId: r.id,
      treatment: r.course!.treatmentName,
      date: "2026-10-23",
      time: "15:00",
      doctor: "Dr. Mehta",
      status: "In progress",
      sitting: 1,
    });
    const prepared = reviewReady(next, "course-visit");
    const completed = completeSession(
        prepared,
        sessionRecord(prepared, "course-visit").id,
        clinician,
        "Reviewed",
      ),
      updated = completed.records["Treatment Plans"].find(
        (c) => c.id === r.id,
      )!;
    expect(updated.completedSittings).toBe(1);
    expect(updated.course?.nextRecommendedDate).toBe("2026-11-20");
    expect(completeAppointment(completed, "course-visit")).toBe(completed);
    const paid = recordPayment(
      completed,
      r.patientId!,
      6480,
      "2026-10-23",
      r.course?.invoiceId,
    );
    expect(courseBalance(paid, updated)).toBe(0);
    expect(
      paid.records["Treatment Plans"].find((c) => c.id === r.id)?.amount,
    ).toBe(0);
  });
  it("records explicit course completion confirmation after all sessions are complete", () => {
    const s = resetState(),
      r = s.records["Treatment Plans"].find((c) => c.id === "course-MM-1041")!;
    r.status = "Completed";
    r.completedSittings = r.totalSittings;
    r.course!.completionConfirmed = false;
    const confirmed = changeCourseStatus(
      s,
      r.id,
      "Completed",
      "All sessions checked; operational completion confirmed",
    );
    expect(
      confirmed.records["Treatment Plans"].find((c) => c.id === r.id)?.course
        ?.completionConfirmed,
    ).toBe(true);
    expect(() =>
      changeCourseStatus(confirmed, r.id, "Completed", "Again"),
    ).toThrow("unavailable");
  });
});
