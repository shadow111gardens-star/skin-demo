import { enrichAdmin } from "./features/admin/adminData";
import type {
  StaffData,
  AdminSettings,
  NotificationState,
} from "./features/admin/model";
import { formatINR } from "./format";
import { enrichCRM } from "./features/crm/crmData";
import type { LeadData } from "./features/crm/model";
import { enrichFinance } from "./features/finance/financeData";
import type {
  InvoiceData,
  PaymentData,
  PackageConfig,
  TaxConfig,
} from "./features/finance/model";
import { enrichOperations } from "./features/operations/operationsData";
import type {
  MachineData,
  RoomData,
  MaintenanceData,
  InventoryData,
  StockMovement,
} from "./features/operations/model";
import { materializeFollowups } from "./features/scheduling/followupLogic";
import type { FollowupData, BookingAudit } from "./features/scheduling/model";
import { enrichSessionState } from "./features/sessions/sessionData";
import type {
  SessionData,
  DeviceDocumentation,
  SessionPolicy,
  CompletionEntry,
} from "./features/sessions/model";
import { enrichClinicalState } from "./features/clinical/clinicalData";
import type {
  TreatmentConfig,
  ConsultationData,
  PlanData,
  CourseData,
} from "./features/clinical/model";
import { enrichScanState } from "./features/scans/scanData";
import type { ScanDetails, ComparisonSnapshot } from "./features/scans/model";
import { enrichPatientState } from "./patientData";
export interface ClinicalInfo {
  history: string;
  allergies: string;
  medications: string;
  procedures: string;
  alerts: string[];
  reviewedBy?: string;
  reviewedAt?: string;
}
export interface Patient {
  id: string;
  name: string;
  age: number;
  phone: string;
  treatment: string;
  email?: string;
  dob?: string;
  gender?: string;
  address?: string;
  emergencyContact?: string;
  referralSource?: string;
  assignedDoctor?: string;
  communicationPreference?: string;
  consentStatus?: string;
  registeredAt?: string;
  clinical?: ClinicalInfo;
  lastVisit: string;
  status: string;
  archivedFrom?: string;
}
export interface Appointment {
  bookingSource?: string;
  notes?: string;
  audit?: BookingAudit[];
  id: string;
  patientId: string;
  time: string;
  date: string;
  treatment: string;
  doctor: string;
  status: string;
  duration?: number;
  courseId?: string;
  sitting?: number;
  totalSittings?: number;
  technician?: string;
  room?: string;
  machineId?: string;
  consent?: boolean;
}
export interface RecordItem {
  staff?: StaffData;
  documentTemplate?: { id: string; name: string; content: string };
  lead?: LeadData;
  invoice?: InvoiceData;
  payment?: PaymentData;
  packageConfig?: PackageConfig;
  machine?: MachineData;
  room?: RoomData;
  maintenance?: MaintenanceData;
  inventory?: InventoryData;
  followup?: FollowupData;
  session?: SessionData;
  deviceDocumentation?: DeviceDocumentation;
  packageSessions?: { total: number; used: number; remaining: number };
  sessionId?: string;
  followupKind?: string;
  treatment?: TreatmentConfig;
  consultation?: ConsultationData;
  plan?: PlanData;
  course?: CourseData;
  scan?: ScanDetails;
  scanComparison?: ComparisonSnapshot;
  imageUrl?: string;
  measurements?: { hydration: number; texture: number; pigmentation: number };
  reviewedBy?: string;
  doctor?: string;
  id: string;
  name: string;
  detail: string;
  status: string;
  amount: number;
  patientId?: string;
  date?: string;
  dueDate?: string;
  appointmentId?: string;
  courseId?: string;
  machineId?: string;
  totalSittings?: number;
  completedSittings?: number;
}
export interface ClinicState {
  patients: Patient[];
  appointments: Appointment[];
  records: Record<string, RecordItem[]>;
  clinicName: string;
  schemaVersion: number;
  adminSchemaVersion?: number;
  adminSettings?: AdminSettings;
  notificationState?: NotificationState;
  crmSchemaVersion?: number;
  analyticsConfiguration?: { roomPlanningMinutes: number };
  financeSchemaVersion?: number;
  taxConfiguration?: TaxConfig[];
  operationsSchemaVersion?: number;
  stockMovements?: StockMovement[];
  patientSchemaVersion?: number;
  scanSchemaVersion?: number;
  clinicalSchemaVersion?: number;
  sessionSchemaVersion?: number;
  sessionPolicy?: SessionPolicy;
  sessionCompletions?: CompletionEntry[];
  activity: { id: string; message: string; at: string; patientId?: string }[];
}
export const modules = [
  "Dashboard",
  "Patients",
  "Skin Analysis",
  "Consultations",
  "Treatment Catalogue",
  "Treatment Plans",
  "Sittings & Sessions",
  "Appointments",
  "Follow-ups",
  "Clinical Documents",
  "Machines & Equipment",
  "Maintenance",
  "Inventory",
  "Rooms & Resources",
  "Packages & Billing",
  "Payments",
  "Leads & Enquiries",
  "Reports & Analytics",
  "Staff & Roles",
  "Clinic Settings",
  "Integrations",
];
export const slug = (s: string) =>
  s.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
export const money = formatINR;
const patients: Patient[] = [
  ["Ananya Sharma", 29, "Laser hair reduction", "Active"],
  ["Rohan Mehta", 34, "PRP hair restoration", "Active"],
  ["Priya Patel", 26, "Acne management", "Active"],
  ["Arjun Kapoor", 41, "HydraFacial", "Follow-up due"],
  ["Meera Iyer", 38, "Skin rejuvenation", "Active"],
  ["Kavya Nair", 31, "Chemical peel", "New"],
].map((p, i) => ({
  id: `MM-${1041 + i}`,
  name: String(p[0]),
  age: Number(p[1]),
  phone: `98765 ${43210 + i}`,
  treatment: p[2] as string,
  status: p[3] as string,
  lastVisit: "23 Oct 2026",
}));
const seed: ClinicState = {
  schemaVersion: 2,
  activity: [],
  patients,
  clinicName: "Aura Skin & Aesthetics",
  appointments: patients.slice(0, 5).map((p, i) => ({
    id: `APT-${201 + i}`,
    patientId: p.id,
    time: ["09:30", "10:00", "10:45", "11:30", "12:15"][i],
    date: "2026-10-23",
    treatment: p.treatment,
    doctor: i % 2 ? "Dr. Neha Kapoor" : "Dr. Aditi Shah",
    status: [
      "Completed",
      "In progress",
      "Checked in",
      "Confirmed",
      "Confirmed",
    ][i],
  })),
  records: {},
};
const entries: Record<string, string[][]> = {
  "Skin Analysis": [
    [
      "Ananya Sharma",
      "Skin assessment · clinician review required",
      "Review pending",
    ],
    ["Priya Patel", "Simulated scan · 22 Oct 2026", "Reviewed"],
  ],
  Consultations: [
    ["Priya Patel", "Acne review · Dr. Aditi Shah", "In progress"],
    ["Meera Iyer", "Pigmentation consultation", "Scheduled"],
  ],
  "Treatment Catalogue": [
    ["Laser hair reduction", "Diode laser · 45 min", "Available"],
    ["PRP hair restoration", "Hair restoration · 60 min", "Available"],
    ["HydraFacial", "Skin rejuvenation · 45 min", "Available"],
    ["Chemical peel", "Clinician-approved protocol · 30 min", "Available"],
  ],
  "Treatment Plans": [
    ["Ananya Sharma", "Laser hair reduction · 3 of 6 sessions", "Active"],
    ["Rohan Mehta", "PRP restoration · 2 of 4 sessions", "Active"],
  ],
  "Sittings & Sessions": [
    ["Ananya Sharma", "Laser hair reduction · session 4", "Consent pending"],
    ["Rohan Mehta", "PRP hair restoration · session 3", "Scheduled"],
  ],
  "Follow-ups": [
    ["Arjun Kapoor", "Post-treatment check · due today", "Due today"],
    ["Priya Patel", "Acne review · 24 Oct", "Scheduled"],
    ["Kavya Nair", "First visit check-in · 25 Oct", "Scheduled"],
  ],
  "Clinical Documents": [
    ["Ananya Sharma", "Laser consent · signed 20 Oct", "Signed"],
    ["Rohan Mehta", "PRP consent · requires signature", "Pending"],
  ],
  "Machines & Equipment": [
    [
      "Soprano ICE Platinum",
      "Laser room 01 · simulated connection",
      "Available",
    ],
    ["HydraFacial Elite", "Treatment room 02 · simulated connection", "In use"],
    ["Dermapen 4", "Treatment room 03", "Available"],
  ],
  Maintenance: [
    ["Soprano ICE Platinum", "Preventive service · 28 Oct 2026", "Upcoming"],
    ["HydraFacial Elite", "Filter replacement · 24 Oct 2026", "Due soon"],
  ],
  Inventory: [
    ["PRP collection kits", "12 kits · reorder at 15", "Low stock"],
    ["Conductive gel", "28 bottles · reorder at 10", "In stock"],
    ["Sterile gloves", "45 boxes · reorder at 20", "In stock"],
  ],
  "Packages & Billing": [
    ["INV-2026-0841 · Ananya Sharma", "Laser course · 6 sessions", "Paid"],
    ["INV-2026-0842 · Rohan Mehta", "PRP course · 4 sessions", "Pending"],
  ],
  Payments: [
    ["Ananya Sharma", "INV-2026-0841 · UPI", "Received"],
    ["Meera Iyer", "INV-2026-0840 · Card", "Received"],
  ],
  "Leads & Enquiries": [
    ["Sneha Desai", "Instagram · laser hair reduction", "New"],
    ["Vikram Rao", "Website · hair restoration", "Contacted"],
  ],
  "Staff & Roles": [
    ["Dr. Aditi Shah", "Dermatologist · clinical administrator", "Active"],
    ["Dr. Neha Kapoor", "Aesthetic physician", "Active"],
    ["Riya Malhotra", "Front desk coordinator", "Active"],
  ],
  Integrations: [
    ["WhatsApp Business", "Demo messaging · simulated delivery", "Simulated"],
    ["Skin scanner", "Demo import · no device connected", "Simulated"],
    ["Razorpay", "Demo payments · no live transactions", "Simulated"],
  ],
};
Object.entries(entries).forEach(
  ([key, list]) =>
    (seed.records[key] = list.map((r, i) => ({
      id: `${slug(key)}-${i + 1}`,
      name: r[0],
      detail: r[1],
      status: r[2],
      amount:
        key === "Packages & Billing" || key === "Payments"
          ? 18000 + i * 6000
          : 0,
    }))),
);

export const DEMO_DATE = "2026-10-23";
export function migrateState(input: ClinicState): ClinicState {
  const s = structuredClone(input);
  s.records = { ...structuredClone(seed.records), ...s.records };
  if (s.schemaVersion === 3)
    return materializeFollowups(
      enrichAdmin(
        enrichCRM(
          enrichFinance(
            enrichOperations(
              enrichSessionState(
                enrichClinicalState(enrichScanState(enrichPatientState(s))),
              ),
            ),
          ),
        ),
      ),
    );
  s.schemaVersion = 3;
  const findPatient = (name: string) =>
    s.patients.find((p) => name.toLowerCase().includes(p.name.toLowerCase()));
  for (const [module, records] of Object.entries(s.records))
    s.records[module] = records.map((r) => ({
      ...r,
      patientId: r.patientId || findPatient(r.name)?.id,
    }));
  s.activity = s.activity || [
    {
      id: "activity-1",
      message: "Ananya Sharma completed her laser sitting.",
      at: "2026-10-23T04:45:00Z",
    },
    {
      id: "activity-2",
      message: "Priya Patel checked in for acne management.",
      at: "2026-10-23T04:40:00Z",
    },
    {
      id: "activity-3",
      message: "UPI payment recorded for Ananya Sharma.",
      at: "2026-10-23T04:20:00Z",
    },
  ];
  if (!s.activity.length)
    s.activity = [
      {
        id: "activity-1",
        message: "Ananya Sharma completed her laser sitting.",
        at: "2026-10-23T04:45:00Z",
      },
      {
        id: "activity-2",
        message: "Priya Patel checked in for acne management.",
        at: "2026-10-23T04:40:00Z",
      },
      {
        id: "activity-3",
        message: "UPI payment recorded for Ananya Sharma.",
        at: "2026-10-23T04:20:00Z",
      },
    ];
  s.appointments = s.appointments.map((a, i) => ({
    ...a,
    duration: a.duration || (a.treatment.includes("PRP") ? 60 : 45),
    courseId: a.courseId || "course-" + a.patientId,
    sitting: a.sitting || (i === 0 ? 4 : i === 1 ? 3 : 1),
    totalSittings: a.totalSittings || (i === 0 ? 6 : 4),
    technician: a.technician || (i % 2 ? "Neha Rao" : "Aarav Singh"),
    room: a.room || "Room 0" + ((i % 3) + 1),
    machineId:
      a.machineId ||
      (a.treatment.includes("Laser")
        ? "machines-equipment-1"
        : a.treatment === "HydraFacial"
          ? "machines-equipment-2"
          : undefined),
    consent:
      a.consent || a.status === "Completed" || a.status === "In progress",
  }));
  const ananya = s.patients.find((p) => p.id === "MM-1041"),
    kavya = s.patients.find((p) => p.id === "MM-1046");
  if (ananya && !s.appointments.some((a) => a.id === "APT-206"))
    s.appointments.push({
      id: "APT-206",
      patientId: ananya.id,
      time: "15:30",
      date: DEMO_DATE,
      treatment: "Laser hair reduction",
      doctor: "Dr. Aditi Shah",
      status: "Confirmed",
      duration: 45,
      courseId: "course-" + ananya.id,
      sitting: 5,
      totalSittings: 6,
      technician: "Aarav Singh",
      room: "Room 01",
      machineId: "machines-equipment-1",
    });
  if (kavya && !s.appointments.some((a) => a.id === "APT-207"))
    s.appointments.push({
      id: "APT-207",
      patientId: kavya.id,
      time: "10:00",
      date: "2026-10-24",
      treatment: "Chemical peel",
      doctor: "Dr. Neha Kapoor",
      status: "Confirmed",
      duration: 45,
      sitting: 1,
      totalSittings: 3,
      technician: "Neha Rao",
      room: "Room 03",
    });
  s.records["Treatment Plans"] = s.records["Treatment Plans"].map((r) => {
    const patientId = r.patientId;
    const known = r.id.startsWith("treatment-plans-");
    const total =
      r.totalSittings || Number(r.detail.match(/of (\d+)/)?.[1]) || 6;
    const completed = Math.max(
      r.completedSittings || Number(r.detail.match(/(\d+) of/)?.[1]) || 0,
      ...s.appointments
        .filter((a) => a.patientId === patientId && a.status === "Completed")
        .map((a) => a.sitting || 1),
    );
    return {
      ...r,
      id: known && patientId ? "course-" + patientId : r.id,
      date: r.date || DEMO_DATE,
      totalSittings: total,
      completedSittings: completed,
    };
  });
  s.appointments = s.appointments.map((a) => ({
    ...a,
    courseId: s.records["Treatment Plans"].some((r) => r.id === a.courseId)
      ? a.courseId
      : undefined,
  }));
  s.records["Sittings & Sessions"] = s.records["Sittings & Sessions"].map(
    (r) => {
      const visit = s.appointments.find((a) =>
        r.appointmentId
          ? a.id === r.appointmentId
          : a.patientId === r.patientId,
      );
      return {
        ...r,
        appointmentId: visit?.id || r.appointmentId,
        courseId: visit?.courseId || r.courseId,
        date: visit?.date || r.date || DEMO_DATE,
        status:
          visit?.status === "Completed"
            ? "Completed"
            : visit?.status === "In progress"
              ? "In progress"
              : r.status,
      };
    },
  );
  const dueDates: Record<string, string> = {
    "follow-ups-1": "2026-10-22",
    "follow-ups-2": DEMO_DATE,
    "follow-ups-3": "2026-10-24",
  };
  s.records["Follow-ups"] = s.records["Follow-ups"].map((r) => ({
    ...r,
    dueDate: r.dueDate || dueDates[r.id] || DEMO_DATE,
    detail: r.detail.replace(" ? due today", ""),
    status:
      r.status === "Completed"
        ? "Completed"
        : r.id === "follow-ups-1"
          ? "Overdue"
          : r.id === "follow-ups-2"
            ? "Due today"
            : r.status,
  }));
  s.records["Packages & Billing"] = s.records["Packages & Billing"].map(
    (r) => ({
      ...r,
      dueDate:
        r.dueDate ||
        (r.id === "packages-billing-1" ? "2026-10-28" : "2026-10-26"),
      date: r.date || DEMO_DATE,
    }),
  );
  s.records["Payments"] = s.records["Payments"].map((r) => ({
    ...r,
    date: r.date || DEMO_DATE,
  }));
  return materializeFollowups(
    enrichAdmin(
      enrichCRM(
        enrichFinance(
          enrichOperations(
            enrichSessionState(
              enrichClinicalState(enrichScanState(enrichPatientState(s))),
            ),
          ),
        ),
      ),
    ),
  );
}
export function readState(): ClinicState {
  try {
    const raw = localStorage.getItem("mmverse-v1");
    return migrateState(raw ? JSON.parse(raw) : seed);
  } catch {
    return migrateState(seed);
  }
}
export function saveState(s: ClinicState) {
  localStorage.setItem("mmverse-v1", JSON.stringify(s));
}
export function resetState() {
  return migrateState(seed);
}
