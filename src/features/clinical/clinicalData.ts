import type { ClinicState } from "../../data";
import type { TreatmentConfig, PlanData, ConsultationData } from "./model";
import { blankConsultation } from "./model";
import { addDays } from "../../services";
export function enrichClinicalState(s: ClinicState): ClinicState {
  if (s.clinicalSchemaVersion === 1) return s;
  s.clinicalSchemaVersion = 1;
  s.records["Plan Proposals"] ||= [];
  const names = [
    "Laser Hair Reduction",
    "Pigmentation Treatment",
    "Acne Treatment",
    "Chemical Peel",
    "HydraFacial",
    "Microneedling",
    "PRP Hair Therapy",
    "Skin Rejuvenation",
    "Scar Treatment",
    "Custom Treatment",
  ];
  const categories = [
    "Laser",
    "Skin concerns",
    "Skin concerns",
    "Peels",
    "Facial care",
    "Skin procedures",
    "Hair care",
    "Skin procedures",
    "Skin procedures",
    "Custom",
  ];
  const prices = [3500, 2800, 1800, 2200, 4500, 5000, 6000, 4000, 5500, 2000];
  const counts = [6, 4, 4, 3, 1, 4, 4, 4, 4, 1];
  const old = s.records["Treatment Catalogue"];
  const used = new Set<string>();
  s.records["Treatment Catalogue"] = names.map((name, i) => {
    const match = old.find(
      (r) =>
        !used.has(r.id) &&
        (r.name.toLowerCase() === name.toLowerCase() ||
          (i === 6 && r.name.toLowerCase().includes("prp"))),
    );
    if (match) used.add(match.id);
    const machines = s.records["Machines & Equipment"];
    const c: TreatmentConfig = {
      category: categories[i],
      duration: [45, 40, 30, 30, 45, 60, 60, 45, 60, 30][i],
      intervalDays: [28, 28, 21, 21, 30, 28, 28, 28, 35, 28][i],
      sessions: counts[i],
      individualPrice: prices[i],
      packagePrice: Math.round(prices[i] * counts[i] * 0.9),
      validityDays: 180,
      machineIds:
        i === 0
          ? ([machines[0]?.id].filter(Boolean) as string[])
          : i === 4
            ? ([machines[1]?.id].filter(Boolean) as string[])
            : i === 5
              ? ([machines[2]?.id].filter(Boolean) as string[])
              : [],
      documentation: "Clinical assessment; relevant history; treatment record",
      consent: "Treatment-specific consent after clinician discussion",
    };
    return {
      ...match,
      id: match?.id || "treatment-" + i,
      name,
      status: match?.status === "Inactive" ? "Inactive" : "Active",
      amount: c.individualPrice,
      detail:
        categories[i] +
        " | " +
        c.duration +
        " min | configurable clinic default",
      treatment: match?.treatment || c,
    };
  });
  s.records["Treatment Catalogue"].push(
    ...old
      .filter(
        (r) =>
          !used.has(r.id) &&
          !s.records["Treatment Catalogue"].some((t) => t.id === r.id),
      )
      .map((r) => ({
        ...r,
        status: r.status === "Inactive" ? "Inactive" : "Active",
        treatment: r.treatment || {
          category: "Custom",
          duration: 30,
          intervalDays: 28,
          sessions: 1,
          individualPrice: r.amount || 2000,
          packagePrice: r.amount || 2000,
          validityDays: 180,
          machineIds: [],
          documentation: "Clinician assessment",
          consent: "Treatment-specific consent",
        },
      })),
  );
  s.records.Consultations = s.records.Consultations.map((r) => ({
    ...r,
    status: r.status === "Reviewed" ? "Reviewed" : "Draft",
    consultation: r.consultation || {
      ...structuredClone(blankConsultation),
      concern: r.detail,
      assessment: "",
      previousReactions: "Not recorded",
      decision: { ...blankConsultation.decision },
    },
  }));
  s.records["Treatment Plans"] = s.records["Treatment Plans"].map((r, i) => {
    if (r.course) return r;
    const p = s.patients.find((p) => p.id === r.patientId);
    if (!p) return r;
    const t =
      s.records["Treatment Catalogue"].find((t) =>
        r.detail.toLowerCase().includes(t.name.toLowerCase().split(" ")[0]),
      ) || s.records["Treatment Catalogue"][0];
    const config = t.treatment!;
    const consultId = "consult-" + r.id,
      planId = "plan-" + r.id;
    const invoice = s.records["Packages & Billing"].find(
      (v) => v.patientId === p.id,
    );
    const sessions = r.totalSittings || config.sessions;
    const total =
      invoice?.amount || (config.packagePrice / config.sessions) * sessions;
    const assessment =
      "Fictional clinician-entered assessment retained with this existing course. Review original history before further treatment.";
    const consultation: ConsultationData = {
      ...structuredClone(blankConsultation),
      concern: "Review of " + t.name.toLowerCase(),
      duration: "Recorded at initial consultation",
      examination:
        "Fictional examination observations documented by the treating clinician.",
      assessment,
      previousReactions:
        "No previous reactions recorded in this demonstration.",
      decision: {
        treatmentId: t.id,
        area: i === 1 ? "Scalp" : "Full face",
        sessions,
        intervalDays: config.intervalDays,
        duration: config.duration,
        price: Math.round(total),
        instructions: "Follow clinician-entered instructions at each visit.",
        consent: config.consent,
      },
      reviewNote: "Historical fictional review",
      reviewedAt: r.date || "2026-09-20",
    };
    if (!s.records.Consultations.some((c) => c.id === consultId))
      s.records.Consultations.push({
        id: consultId,
        name: p.name,
        patientId: p.id,
        status: "Reviewed",
        date: r.date || "2026-09-20",
        doctor: p.assignedDoctor || "Dr. Mehta",
        reviewedBy: p.assignedDoctor || "Dr. Mehta",
        detail: consultation.concern,
        amount: 0,
        consultation,
      });
    const plan: PlanData = {
      consultationId: consultId,
      treatmentId: t.id,
      treatmentName: t.name,
      area: consultation.decision.area,
      sessions,
      intervalDays: config.intervalDays,
      duration: config.duration,
      doctor: p.assignedDoctor || "Dr. Mehta",
      technician: i === 1 ? "Neha Rao" : "Aarav Singh",
      pricing: "package",
      individualPrice: config.individualPrice,
      packagePrice: Math.round(total),
      packageSessions: sessions,
      validityDays: 180,
      instructions: consultation.decision.instructions,
      consent: config.consent,
      assessment,
      notes: "Historical fictional plan",
      approvedBy: p.assignedDoctor || "Dr. Mehta",
      approvedAt: r.date || "2026-09-20",
      courseId: r.id,
    };
    if (!s.records["Plan Proposals"].some((c) => c.id === planId))
      s.records["Plan Proposals"].push({
        id: planId,
        name: p.name,
        patientId: p.id,
        date: r.date,
        status: "Converted to Course",
        detail: t.name + " | historical approved plan",
        amount: Math.round(total),
        courseId: r.id,
        plan,
      });
    if (invoice) invoice.courseId = r.id;
    return {
      ...r,
      doctor: plan.doctor,
      course: {
        completionConfirmed: r.status === "Completed",
        planId,
        consultationId: consultId,
        treatmentId: t.id,
        treatmentName: t.name,
        area: plan.area,
        approvingDoctor: plan.doctor,
        assignedDoctor: plan.doctor,
        technician: plan.technician,
        startDate: r.date || "2026-09-20",
        intervalDays: config.intervalDays,
        validUntil: addDays(r.date || "2026-09-20", 180),
        packagePrice: Math.round(total),
        invoiceId: invoice?.id,
        nextRecommendedDate:
          r.status === "Completed" ? undefined : "2026-10-30",
        instructions: plan.instructions,
        consent: plan.consent,
      },
    };
  });
  for (const [patientId, status, treatmentIndex] of [
    ["MM-1043", "Awaiting Approval", 2],
    ["MM-1046", "Draft", 3],
  ] as const) {
    const patient = s.patients.find((p) => p.id === patientId),
      t = s.records["Treatment Catalogue"][treatmentIndex];
    if (!patient || !t?.treatment) continue;
    const config = t.treatment,
      consultationId = "consult-proposal-" + patientId,
      planId = "proposal-" + patientId;
    const consultation: ConsultationData = {
      ...structuredClone(blankConsultation),
      concern: "Fictional consultation for " + t.name,
      duration: "Three months",
      examination:
        "Fictional observations recorded during clinician examination.",
      assessment:
        status === "Draft"
          ? ""
          : "Clinician-entered fictional assessment for discussion and approval.",
      previousReactions:
        "No prior reactions recorded; confirm during clinician review.",
      decision: {
        treatmentId: t.id,
        area: "Full face",
        sessions: config.sessions,
        intervalDays: config.intervalDays,
        duration: config.duration,
        price: config.packagePrice,
        instructions:
          "Discuss patient-specific care instructions during the consultation.",
        consent: config.consent,
      },
      reviewNote:
        status === "Draft" ? "" : "Fictional clinician review recorded.",
      reviewedAt: status === "Draft" ? undefined : "2026-10-22",
    };
    if (!s.records.Consultations.some((c) => c.id === consultationId))
      s.records.Consultations.push({
        id: consultationId,
        name: patient.name,
        patientId,
        date: "2026-10-22",
        doctor: patient.assignedDoctor,
        status: status === "Draft" ? "Draft" : "Reviewed",
        reviewedBy: status === "Draft" ? undefined : patient.assignedDoctor,
        detail: consultation.concern,
        amount: 0,
        consultation,
      });
    const plan: PlanData = {
      consultationId,
      treatmentId: t.id,
      treatmentName: t.name,
      area: "Full face",
      sessions: config.sessions,
      intervalDays: config.intervalDays,
      duration: config.duration,
      doctor: patient.assignedDoctor || "Dr. Mehta",
      technician: "Neha Rao",
      pricing: "package",
      individualPrice: config.individualPrice,
      packagePrice: config.packagePrice,
      packageSessions: config.sessions,
      validityDays: config.validityDays,
      instructions: consultation.decision.instructions,
      consent: config.consent,
      assessment: consultation.assessment,
      notes:
        status === "Draft"
          ? ""
          : "Fictional patient-specific plan submitted for clinician approval.",
    };
    if (!s.records["Plan Proposals"].some((p) => p.id === planId))
      s.records["Plan Proposals"].push({
        id: planId,
        name: patient.name,
        patientId,
        date: "2026-10-23",
        status,
        detail: t.name + " | Full face",
        amount: config.packagePrice,
        plan,
      });
  }
  return s;
}
