import { courseInvoice, invoiceBalance, round } from "../finance/ledger";
import { DEMO_DATE, type ClinicState, type RecordItem } from "../../data";
import { addDays } from "../../services";
import { estimate, type PlanStatus, type TreatmentConfig } from "./model";
export function upsert(
  s: ClinicState,
  module: string,
  r: RecordItem,
): ClinicState {
  return {
    ...s,
    records: {
      ...s.records,
      [module]: s.records[module].some((v) => v.id === r.id)
        ? s.records[module].map((v) => (v.id === r.id ? r : v))
        : [r, ...s.records[module]],
    },
  };
}
export function validateTreatment(c: TreatmentConfig) {
  if (!c.category.trim()) return "Enter a treatment category.";
  if (!Number.isInteger(c.sessions) || c.sessions < 1 || c.sessions > 100)
    return "Default sessions must be a whole number between 1 and 100.";
  for (const n of [c.duration, c.intervalDays, c.validityDays])
    if (!Number.isInteger(n) || n < 1 || n > 3650)
      return "Duration, interval and validity must be positive whole numbers.";
  if (
    [c.individualPrice, c.packagePrice].some(
      (v) => !Number.isFinite(v) || v < 0 || v > 10000000,
    )
  )
    return "Enter prices between 0 and 1,00,00,000 INR.";
  if (!c.documentation.trim() || !c.consent.trim())
    return "Record documentation and consent requirements.";
  return "";
}
export function saveTreatment(s: ClinicState, r: RecordItem) {
  if (!r.name.trim() || !r.treatment)
    throw new Error("Enter a treatment name and configuration.");
  const error = validateTreatment(r.treatment);
  if (error) throw new Error(error);
  if (
    s.records["Treatment Catalogue"].some(
      (t) =>
        t.id !== r.id && t.name.toLowerCase() === r.name.trim().toLowerCase(),
    )
  )
    throw new Error("A treatment with this name already exists.");
  return upsert(s, "Treatment Catalogue", {
    ...r,
    name: r.name.trim(),
    amount: r.treatment.individualPrice,
  });
}
export function validateDecision(r: RecordItem) {
  const d = r.consultation?.decision;
  if (!d || !d.treatmentId || !d.area.trim())
    return "Choose a treatment and enter the treatment area.";
  if (!Number.isInteger(d.sessions) || d.sessions < 1 || d.sessions > 100)
    return "Proposed sessions must be a whole number between 1 and 100.";
  if (
    !Number.isInteger(d.intervalDays) ||
    d.intervalDays < 1 ||
    !Number.isInteger(d.duration) ||
    d.duration < 1
  )
    return "Enter a positive interval and duration.";
  if (!Number.isFinite(d.price) || d.price < 0)
    return "Enter a valid proposed price in INR.";
  if (!d.consent.trim()) return "Record consent requirements.";
  return "";
}
export function saveConsultation(s: ClinicState, r: RecordItem) {
  const p = s.patients.find((p) => p.id === r.patientId);
  if (!p || p.status === "Archived")
    throw new Error("Select an existing, non-archived patient.");
  const previous = s.records.Consultations.find((v) => v.id === r.id);
  if (previous?.status === "Reviewed")
    throw new Error(
      "A reviewed consultation is retained as a clinical snapshot. Start a new consultation.",
    );
  if (r.status !== "Draft") {
    const c = r.consultation!;
    if (
      !r.doctor ||
      !c.concern.trim() ||
      !c.duration.trim() ||
      !c.examination.trim() ||
      c.assessment.trim().length < 5
    )
      throw new Error(
        "Complete concern, duration, examination, clinician assessment and assigned doctor before submitting.",
      );
    const error = validateDecision(r);
    if (error) throw new Error(error);
    if (
      !s.records["Treatment Catalogue"].some(
        (t) => t.id === c.decision.treatmentId && t.status === "Active",
      )
    )
      throw new Error("Select an active treatment.");
  }
  return upsert(s, "Consultations", { ...r, name: p.name });
}
export function reviewConsultation(
  s: ClinicState,
  id: string,
  doctor: string,
  note: string,
) {
  const r = s.records.Consultations.find((v) => v.id === id);
  if (!r?.consultation || r.status !== "Awaiting Review")
    throw new Error("Submit the consultation for review first.");
  if (!doctor.trim() || !note.trim())
    throw new Error("Select a reviewing doctor and enter a review note.");
  return upsert(s, "Consultations", {
    ...r,
    status: "Reviewed",
    reviewedBy: doctor,
    consultation: {
      ...r.consultation,
      reviewNote: note,
      reviewedAt: DEMO_DATE,
    },
  });
}
export function validatePlan(s: ClinicState, r: RecordItem) {
  const p = r.plan!;
  if (
    !p ||
    !s.patients.some((v) => v.id === r.patientId && v.status !== "Archived")
  )
    return "Choose an existing, non-archived patient.";
  const c = s.records.Consultations.find(
    (v) => v.id === p.consultationId && v.patientId === r.patientId,
  );
  if (!c?.consultation?.assessment.trim())
    return "Select this patient’s consultation with a clinician-entered assessment.";
  if (
    !s.records["Treatment Catalogue"].some(
      (t) => t.id === p.treatmentId && t.status === "Active",
    )
  )
    return "Choose an active treatment from the catalogue.";
  if (!p.area.trim() || !p.doctor.trim())
    return "Enter the treatment area and assign a doctor.";
  if (!Number.isInteger(p.sessions) || p.sessions < 1 || p.sessions > 100)
    return "Sessions must be a whole number between 1 and 100.";
  if (
    !Number.isInteger(p.intervalDays) ||
    p.intervalDays < 1 ||
    !Number.isInteger(p.duration) ||
    p.duration < 1 ||
    !Number.isInteger(p.validityDays) ||
    p.validityDays < 1
  )
    return "Enter positive whole numbers for interval, duration and validity.";
  if (
    !Number.isInteger(p.packageSessions) ||
    p.packageSessions < 1 ||
    [p.individualPrice, p.packagePrice].some(
      (v) => !Number.isFinite(v) || v < 0,
    ) ||
    !Number.isFinite(estimate(p))
  )
    return "Enter a valid price configuration.";
  if (!p.consent.trim() || !p.notes.trim())
    return "Record consent requirements and a clinician plan note.";
  return "";
}
export function savePlan(s: ClinicState, r: RecordItem) {
  if (!s.patients.some((p) => p.id === r.patientId && p.status !== "Archived"))
    throw new Error("Choose an existing, non-archived patient.");
  const previous = s.records["Plan Proposals"].find((p) => p.id === r.id);
  if (previous && !["Draft", "Declined"].includes(previous.status))
    throw new Error("Only draft or declined proposals can be edited.");
  if (r.status === "Awaiting Approval") {
    const e = validatePlan(s, r);
    if (e) throw new Error(e);
  }
  const p = s.patients.find((p) => p.id === r.patientId)!;
  return upsert(s, "Plan Proposals", {
    ...r,
    name: p.name,
    amount: r.plan && Number.isFinite(estimate(r.plan)) ? estimate(r.plan) : 0,
  });
}
export function transitionPlan(
  s: ClinicState,
  id: string,
  status: PlanStatus,
  doctor: string,
  reason = "",
) {
  const r = s.records["Plan Proposals"].find((v) => v.id === id);
  if (
    !r?.plan ||
    r.status !== "Awaiting Approval" ||
    !["Approved", "Declined"].includes(status)
  )
    throw new Error(
      "Only a proposal awaiting approval can be approved or declined.",
    );
  if (!doctor.trim()) throw new Error("Select the reviewing doctor.");
  if (status === "Declined" && !reason.trim())
    throw new Error("Enter a reason for declining the plan.");
  if (status === "Approved") {
    const e = validatePlan(s, r);
    if (e) throw new Error(e);
    if (
      s.records.Consultations.find((c) => c.id === r.plan!.consultationId)
        ?.status !== "Reviewed"
    )
      throw new Error(
        "The linked consultation requires clinician review before plan approval.",
      );
  }
  return upsert(s, "Plan Proposals", {
    ...r,
    status,
    reviewedBy: doctor,
    plan: {
      ...r.plan,
      approvedBy: status === "Approved" ? doctor : undefined,
      approvedAt: status === "Approved" ? DEMO_DATE : undefined,
      declineReason: status === "Declined" ? reason : undefined,
      approvalNote: status === "Approved" ? reason : undefined,
    },
  });
}
export function convertPlan(
  s: ClinicState,
  id: string,
  packageId?: string,
): ClinicState {
  const r = s.records["Plan Proposals"].find((v) => v.id === id);
  if (!r?.plan) throw new Error("Plan not found.");
  const existing = s.records["Treatment Plans"].find(
    (c) => c.course?.planId === id,
  );
  if (existing) return s;
  if (r.status !== "Approved")
    throw new Error("Approve the plan before converting it to a course.");
  const p = r.plan;
  const offer = packageId
    ? s.records["Package Catalogue"]?.find((v) => v.id === packageId)
    : undefined;
  if (
    packageId &&
    (!offer?.packageConfig ||
      offer.status !== "Active" ||
      offer.packageConfig.treatmentId !== p.treatmentId ||
      offer.packageConfig.sessions !== p.sessions ||
      ![p.area, "Any clinician-approved area"].includes(
        offer.packageConfig.area,
      ))
  )
    throw new Error(
      "Choose an active package matching the approved treatment, area and session count.",
    );
  const courseId = "course-" + id,
    invoiceId = "invoice-" + courseId,
    total = offer?.packageConfig
      ? round(offer.packageConfig.price - offer.packageConfig.discount)
      : estimate(p);
  const course: RecordItem = {
    id: courseId,
    name: r.name,
    patientId: r.patientId,
    status: "Active",
    amount: total,
    date: DEMO_DATE,
    doctor: p.doctor,
    totalSittings: p.sessions,
    completedSittings: 0,
    detail: p.treatmentName + " | " + p.area + " | " + p.sessions + " sessions",
    course: {
      planId: id,
      consultationId: p.consultationId,
      treatmentId: p.treatmentId,
      treatmentName: p.treatmentName,
      area: p.area,
      approvingDoctor: p.approvedBy!,
      assignedDoctor: p.doctor,
      technician: p.technician,
      startDate: DEMO_DATE,
      intervalDays: p.intervalDays,
      validUntil: addDays(
        DEMO_DATE,
        offer?.packageConfig?.validityDays || p.validityDays,
      ),
      packageTemplateId: offer?.id,
      packageTerms: offer?.packageConfig?.terms,
      packagePrice: total,
      invoiceId,
      nextRecommendedDate: DEMO_DATE,
      instructions: p.instructions,
      consent: p.consent,
    },
  };
  let next = upsert(s, "Treatment Plans", course);
  next = upsert(
    next,
    "Packages & Billing",
    courseInvoice(
      invoiceId,
      r.patientId!,
      courseId,
      (offer?.name || p.treatmentName) +
        " | " +
        p.sessions +
        " sessions | " +
        p.area,
      total,
    ),
  );
  return upsert(next, "Plan Proposals", {
    ...r,
    status: "Converted to Course",
    courseId,
    plan: { ...p, courseId },
  });
}
export function courseBalance(s: ClinicState, r: RecordItem) {
  return round(
    s.records["Packages & Billing"]
      .filter((i) => i.courseId === r.id)
      .reduce((n, i) => n + invoiceBalance(s, i), 0),
  );
}
export function changeCourseStatus(
  s: ClinicState,
  id: string,
  status: string,
  note: string,
) {
  const r = s.records["Treatment Plans"].find((v) => v.id === id);
  if (!r?.course) throw new Error("Course not found.");
  const allowed: Record<string, string[]> = {
    Active: ["Paused", "Cancelled", "Completed"],
    Paused: ["Active", "Cancelled"],
    Completed: r.course.completionConfirmed ? [] : ["Completed"],
    Cancelled: [],
  };
  if (!allowed[r.status]?.includes(status))
    throw new Error("This course transition is unavailable.");
  if (!note.trim())
    throw new Error("Record a clinician reason for this change.");
  if (
    status === "Completed" &&
    (r.completedSittings || 0) < (r.totalSittings || 0)
  )
    throw new Error(
      "Complete all planned sessions before marking this course completed.",
    );
  const next = upsert(s, "Treatment Plans", {
    ...r,
    status,
    course: {
      ...r.course,
      statusNote: note,
      ...(status === "Completed"
        ? { completionConfirmed: true, completionConfirmedAt: DEMO_DATE }
        : {}),
    },
  });
  if (status !== "Cancelled") return next;
  return {
    ...next,
    appointments: next.appointments.map((a) =>
      a.courseId === id && !["Completed", "Cancelled"].includes(a.status)
        ? { ...a, status: "Cancelled" }
        : a,
    ),
    records: {
      ...next.records,
      "Sittings & Sessions": next.records["Sittings & Sessions"].map((v) =>
        v.courseId === id && v.status !== "Completed"
          ? {
              ...v,
              status: "Cancelled",
              ...(v.session
                ? {
                    session: {
                      ...v.session,
                      audit: [
                        {
                          id: crypto.randomUUID(),
                          at: new Date().toISOString(),
                          actor: "Clinic clinician",
                          status: "Cancelled",
                          action: "Course cancelled; no sitting consumed",
                          note,
                        },
                        ...v.session.audit,
                      ],
                    },
                  }
                : {}),
            }
          : v,
      ),
    },
  };
}
