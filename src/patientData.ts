import type { ClinicState, Patient } from "./data";
const demo = "2026-10-23";
const profiles: Record<string, Partial<Patient>> = {
  "MM-1041": {
    email: "ananya.sharma@example.test",
    dob: "1997-04-18",
    gender: "Woman",
    address: "12, 5th Main, Indiranagar, Bengaluru",
    assignedDoctor: "Dr. Aditi Shah",
    referralSource: "Instagram",
    communicationPreference: "WhatsApp",
    consentStatus: "Granted",
    status: "Active",
    clinical: {
      history:
        "No chronic conditions reported. Reviewed before the current laser course.",
      allergies: "Latex sensitivity reported.",
      medications: "None reported at the last review.",
      procedures: "Three previous laser sittings before this demo period.",
      alerts: [
        "Latex sensitivity — review recorded precautions before each sitting.",
      ],
      reviewedBy: "Dr. Aditi Shah",
      reviewedAt: "2026-10-20",
    },
  },
  "MM-1042": {
    email: "rohan.mehta@example.test",
    dob: "1992-02-03",
    gender: "Man",
    address: "41, 100 Feet Road, Bengaluru",
    assignedDoctor: "Dr. Neha Kapoor",
    referralSource: "Patient referral",
    communicationPreference: "Phone",
    consentStatus: "Granted",
    status: "Active",
    clinical: {
      history:
        "Patient-reported hair thinning; clinical history reviewed at consultation.",
      allergies: "No known drug allergies reported.",
      medications: "Patient-reported supplements; verify at the next review.",
      procedures: "Two PRP sittings completed before this demo period.",
      alerts: [],
      reviewedBy: "Dr. Neha Kapoor",
      reviewedAt: "2026-10-18",
    },
  },
  "MM-1043": {
    email: "priya.patel@example.test",
    dob: "2000-08-14",
    gender: "Woman",
    address: "8, Domlur Layout, Bengaluru",
    assignedDoctor: "Dr. Aditi Shah",
    referralSource: "Website",
    communicationPreference: "Email",
    consentStatus: "Granted",
    status: "Active",
    clinical: {
      history:
        "Recurrent acne reviewed in consultation. No systemic history reported.",
      allergies: "No allergies reported.",
      medications:
        "Topical skincare recorded in the clinician’s consultation note.",
      procedures: "No previous procedures reported.",
      alerts: [],
      reviewedBy: "Dr. Aditi Shah",
      reviewedAt: "2026-10-22",
    },
  },
  "MM-1044": {
    email: "arjun.kapoor@example.test",
    dob: "1985-01-08",
    gender: "Man",
    address: "22, HAL 2nd Stage, Bengaluru",
    assignedDoctor: "Dr. Neha Kapoor",
    referralSource: "Walk-in",
    communicationPreference: "Phone",
    consentStatus: "Granted",
    status: "Overdue",
    clinical: {
      history: "History of photosensitivity reported and reviewed.",
      allergies: "No known drug allergies reported.",
      medications: "Not recorded; confirm at the next consultation.",
      procedures: "HydraFacial in September 2026.",
      alerts: [
        "History of photosensitivity — clinician review required before further treatment.",
      ],
      reviewedBy: "Dr. Neha Kapoor",
      reviewedAt: "2026-10-17",
    },
  },
  "MM-1045": {
    email: "meera.iyer@example.test",
    dob: "1988-06-22",
    gender: "Woman",
    address: "6, Cambridge Layout, Bengaluru",
    assignedDoctor: "Dr. Aditi Shah",
    referralSource: "Patient referral",
    communicationPreference: "WhatsApp",
    consentStatus: "Granted",
    status: "Completed",
    clinical: {
      history:
        "Skin rejuvenation course completed; maintenance review scheduled.",
      allergies: "No allergies reported.",
      medications: "None reported at the last review.",
      procedures: "Four rejuvenation sittings, completed 20 October 2026.",
      alerts: [],
      reviewedBy: "Dr. Aditi Shah",
      reviewedAt: "2026-10-20",
    },
  },
  "MM-1046": {
    email: "kavya.nair@example.test",
    dob: "1995-03-09",
    gender: "Woman",
    address: "17, Old Airport Road, Bengaluru",
    assignedDoctor: "Dr. Neha Kapoor",
    referralSource: "Google search",
    communicationPreference: "Email",
    consentStatus: "Pending",
    status: "New",
  },
};
export function enrichPatientState(s: ClinicState): ClinicState {
  if (s.patientSchemaVersion === 1) return s;
  s.patientSchemaVersion = 1;
  s.patients = s.patients.map((p) => {
    const details = profiles[p.id];
    return {
      ...details,
      ...p,
      ...(details && ["Active", "Follow-up due", "New"].includes(p.status)
        ? { status: details.status! }
        : {}),
      email: p.email || details?.email || "",
      dob: p.dob || details?.dob || "",
      assignedDoctor:
        p.assignedDoctor || details?.assignedDoctor || "Dr. Aditi Shah",
      communicationPreference:
        p.communicationPreference ||
        details?.communicationPreference ||
        "Phone",
      consentStatus: p.consentStatus || details?.consentStatus || "Pending",
      clinical: p.clinical || details?.clinical,
      registeredAt: p.registeredAt || "2026-09-01",
      emergencyContact: p.emergencyContact || "",
      gender: p.gender || details?.gender || "Prefer not to say",
      address: p.address || details?.address || "",
      referralSource:
        p.referralSource || details?.referralSource || "Not recorded",
    };
  });
  s.records["Photos"] = s.records["Photos"] || [];
  for (const key of ["Clinical Documents", "Skin Analysis", "Consultations"])
    s.records[key] = s.records[key].map((r) => ({
      ...r,
      patientId:
        r.patientId || s.patients.find((p) => r.name.includes(p.name))?.id,
      date: r.date || demo,
    }));
  s.records["Skin Analysis"] = s.records["Skin Analysis"].map((r, i) =>
    r.patientId
      ? {
          ...r,
          measurements: r.measurements || {
            hydration: 68 - i * 7,
            texture: 63 - i * 5,
            pigmentation: 42 + i * 4,
          },
          reviewedBy: r.status === "Reviewed" ? "Dr. Aditi Shah" : undefined,
        }
      : r,
  );
  if (
    s.patients.some((p) => p.id === "MM-1041") &&
    !s.records["Skin Analysis"].some((r) => r.id === "scan-history-1041")
  )
    s.records["Skin Analysis"].push({
      id: "scan-history-1041",
      name: "Ananya Sharma",
      patientId: "MM-1041",
      date: "2026-09-23",
      status: "Reviewed",
      amount: 0,
      detail: "Simulated baseline scan · clinician-reviewed demo measurements",
      measurements: { hydration: 62, texture: 56, pigmentation: 46 },
      reviewedBy: "Dr. Aditi Shah",
    });
  if (
    s.patients.some((p) => p.id === "MM-1045") &&
    !s.records["Treatment Plans"].some((r) => r.id === "course-MM-1045")
  ) {
    s.records["Treatment Plans"].push({
      id: "course-MM-1045",
      name: "Meera Iyer",
      patientId: "MM-1045",
      detail: "Skin rejuvenation · completed course",
      status: "Completed",
      amount: 0,
      date: "2026-09-20",
      totalSittings: 4,
      completedSittings: 4,
    });
    s.records["Sittings & Sessions"].push({
      id: "session-history-1045",
      name: "Meera Iyer",
      patientId: "MM-1045",
      courseId: "course-MM-1045",
      detail: "Skin rejuvenation · sitting 4 of 4 · historical demo record",
      status: "Completed",
      amount: 0,
      date: "2026-10-20",
    });
  }
  s.records["Packages & Billing"] = s.records["Packages & Billing"].map(
    (r) => ({
      ...r,
      courseId:
        r.courseId ||
        s.records["Treatment Plans"].find((c) => c.patientId === r.patientId)
          ?.id,
    }),
  );
  s.activity = s.activity.map((a) => ({
    ...a,
    patientId:
      a.patientId || s.patients.find((p) => a.message.includes(p.name))?.id,
  }));
  return s;
}
