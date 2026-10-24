import { clinicDoctors } from "../admin/access";
import {
  DEMO_DATE,
  type ClinicState,
  type RecordItem,
  type Patient,
} from "../../data";
import { safeDate } from "../../services";
import {
  validPhone,
  validEmail,
  likelyDuplicates,
  normalizedPhone,
  calculateAge,
  generatePatientId,
} from "../../patientServices";
import { addActivity } from "../../store";
import { leadStages, type LeadStage, type LeadContact } from "./model";
const validDate = (d: string) => !!d && safeDate(d) === d;
const event = (
  stage: LeadStage,
  action: string,
  note: string,
  employee: string,
  date = DEMO_DATE,
) => ({
  id: crypto.randomUUID(),
  at: new Date().toISOString(),
  date,
  stage,
  action,
  note,
  employee,
});
const upsert = (s: ClinicState, r: RecordItem): ClinicState => ({
  ...s,
  records: {
    ...s.records,
    "Leads & Enquiries": s.records["Leads & Enquiries"].some(
      (v) => v.id === r.id,
    )
      ? s.records["Leads & Enquiries"].map((v) => (v.id === r.id ? r : v))
      : [r, ...s.records["Leads & Enquiries"]],
  },
});
export function leadMatches(s: ClinicState, r: RecordItem) {
  return r.lead ? likelyDuplicates(s.patients, r.lead.phone, r.lead.email) : [];
}
export function saveLead(s: ClinicState, r: RecordItem) {
  const d = r.lead,
    old = s.records["Leads & Enquiries"].find((v) => v.id === r.id);
  if (
    !d ||
    r.name.trim().length < 2 ||
    !validPhone(d.phone) ||
    !validEmail(d.email.trim())
  )
    throw new Error(
      "Enter a full name, valid Indian mobile and valid optional email.",
    );
  if (
    !s.records["Treatment Catalogue"].some((t) => t.id === d.treatmentId) ||
    !d.source.trim() ||
    !d.assignedTo.trim()
  )
    throw new Error(
      "Choose an interested treatment, source and assigned employee.",
    );
  if (!Number.isFinite(r.amount) || r.amount < 0)
    throw new Error("Estimated value must be a non-negative INR amount.");
  if (
    !validDate(d.createdDate) ||
    d.createdDate > DEMO_DATE ||
    (d.nextFollowup && !validDate(d.nextFollowup))
  )
    throw new Error(
      "Use a valid enquiry date on/before the operating day and valid follow-up date.",
    );
  if (
    s.records["Leads & Enquiries"].some(
      (v) =>
        v.id !== r.id &&
        v.lead &&
        (normalizedPhone(v.lead.phone) === normalizedPhone(d.phone) ||
          (!!d.email.trim() &&
            v.lead.email.toLowerCase() === d.email.trim().toLowerCase())),
    )
  )
    throw new Error(
      "This mobile or email already has an enquiry. Search and update the existing lead.",
    );
  const status = (old?.status || "New Enquiry") as LeadStage;
  const next = {
    ...r,
    name: r.name.trim(),
    status,
    patientId: old?.patientId,
    date: old?.lead?.createdDate || d.createdDate,
    detail: d.notes,
    lead: {
      ...d,
      phone: d.phone.trim(),
      email: d.email.trim().toLowerCase(),
      createdDate: old?.lead?.createdDate || d.createdDate,
      contacts: old?.lead?.contacts || [],
      events: [
        ...(old?.lead?.events || []),
        event(
          status,
          old ? "Lead edited" : "Lead created",
          "Enquiry details saved",
          d.assignedTo,
        ),
      ],
      convertedAt: old?.lead?.convertedAt,
      appointmentId: old?.lead?.appointmentId,
      lastContact: old?.lead?.lastContact,
      nextFollowup: ["Won", "Lost"].includes(status)
        ? undefined
        : d.nextFollowup,
    },
  };
  return addActivity(
    upsert(s, next),
    `${r.name}: enquiry ${old ? "updated" : "created"}.`,
    old?.patientId,
  );
}
export function changeLeadStage(
  s: ClinicState,
  id: string,
  stage: LeadStage,
  note: string,
  employee: string,
  confirmed: boolean,
) {
  const r = s.records["Leads & Enquiries"].find((r) => r.id === id);
  if (!r?.lead || !leadStages.includes(stage))
    throw new Error("Choose an existing lead and valid stage.");
  if (!note.trim() || !employee.trim())
    throw new Error("Record a stage-change reason and employee.");
  if (stage === r.status) return s;
  if (
    (["Won", "Lost"].includes(stage) || ["Won", "Lost"].includes(r.status)) &&
    !confirmed
  )
    throw new Error("Confirm closing or reopening this enquiry.");
  return addActivity(
    upsert(s, {
      ...r,
      status: stage,
      lead: {
        ...r.lead,
        nextFollowup: ["Won", "Lost"].includes(stage)
          ? undefined
          : r.lead.nextFollowup,
        events: [
          ...r.lead.events,
          event(stage, "Stage changed", note, employee),
        ],
      },
    }),
    `${r.name}: enquiry moved to ${stage}.`,
    r.patientId,
  );
}
export function logLeadContact(
  s: ClinicState,
  id: string,
  contact: LeadContact,
  nextFollowup: string,
) {
  const r = s.records["Leads & Enquiries"].find((r) => r.id === id);
  if (!r?.lead) throw new Error("Lead not found.");
  if (["Won", "Lost"].includes(r.status))
    throw new Error("Reopen this enquiry before logging another contact.");
  if (r.lead.contacts.some((c) => c.id === contact.id)) return s;
  if (
    !validDate(contact.date) ||
    contact.date > DEMO_DATE ||
    contact.date < r.lead.createdDate ||
    !contact.method ||
    !contact.outcome ||
    !contact.employee.trim() ||
    !contact.note.trim()
  )
    throw new Error(
      "Record a valid contact date between enquiry creation and the operating day, method, outcome, employee and notes.",
    );
  if (nextFollowup && (!validDate(nextFollowup) || nextFollowup < contact.date))
    throw new Error("Next follow-up cannot precede the contact date.");
  const contacts = [contact, ...r.lead.contacts],
    lastContact = contacts
      .map((c) => c.date)
      .sort()
      .at(-1),
    stage = (r.status === "New Enquiry" ? "Contacted" : r.status) as LeadStage;
  return addActivity(
    upsert(s, {
      ...r,
      status: stage,
      lead: {
        ...r.lead,
        contacts,
        lastContact,
        nextFollowup: nextFollowup || undefined,
        events: [
          ...r.lead.events,
          event(
            stage,
            "Contact logged",
            contact.note,
            contact.employee,
            contact.date,
          ),
        ],
      },
    }),
    `${r.name}: ${contact.method.toLowerCase()} contact manually logged.`,
    r.patientId,
  );
}
export interface ConversionFields {
  name: string;
  phone: string;
  email: string;
  dob: string;
  gender: string;
  address: string;
  doctor: string;
  preference: string;
  consent: string;
}
export function convertLead(
  s: ClinicState,
  id: string,
  fields: ConversionFields,
  reuseId?: string,
) {
  const r = s.records["Leads & Enquiries"].find((v) => v.id === id);
  if (!r?.lead) throw new Error("Lead not found.");
  if (r.patientId) {
    const patient = s.patients.find((p) => p.id === r.patientId);
    if (!patient)
      throw new Error("Linked patient is unavailable. Review the record.");
    return { state: s, patient };
  }
  if (r.status === "Lost")
    throw new Error("Reopen the lost enquiry before converting it.");
  let patient: Patient | undefined;
  let next = s;
  if (reuseId) {
    patient = s.patients.find((p) => p.id === reuseId);
    if (!patient || patient.status === "Archived")
      throw new Error(
        "Choose an existing active patient; restore archived records from Patients first.",
      );
    const matches = [
      ...leadMatches(s, r),
      ...likelyDuplicates(s.patients, fields.phone, fields.email),
    ];
    if (!matches.some((p) => p.id === reuseId))
      throw new Error("Select one of the matching patient records.");
  } else {
    const age = calculateAge(fields.dob);
    if (
      fields.name.trim().length < 2 ||
      !validPhone(fields.phone) ||
      !validEmail(fields.email.trim()) ||
      age === null ||
      age > 120 ||
      !clinicDoctors(s).includes(fields.doctor) ||
      !["Phone", "WhatsApp", "Email"].includes(fields.preference) ||
      !["Pending", "Recorded", "Declined"].includes(fields.consent) ||
      (fields.preference === "Email" && !fields.email.trim())
    )
      throw new Error(
        "Enter a valid name, mobile, optional email, date of birth (age 0–120), assigned doctor, contact preference and consent.",
      );
    if (
      leadMatches(s, r).length ||
      likelyDuplicates(s.patients, fields.phone, fields.email).length
    )
      throw new Error(
        "Likely existing patient found. Reuse the matching record instead of creating another contact.",
      );
    patient = {
      id: generatePatientId(s.patients),
      name: fields.name.trim(),
      phone: fields.phone.trim(),
      email: fields.email.trim().toLowerCase(),
      dob: fields.dob,
      age,
      gender: fields.gender,
      address: fields.address,
      assignedDoctor: fields.doctor,
      communicationPreference: fields.preference,
      consentStatus: fields.consent,
      referralSource: r.lead.source,
      treatment:
        s.records["Treatment Catalogue"].find(
          (t) => t.id === r.lead!.treatmentId,
        )?.name || "Consultation",
      registeredAt: DEMO_DATE,
      status: "New",
      lastVisit: "Not visited",
    };
    next = { ...s, patients: [patient, ...s.patients] };
  }
  const stage = (
    r.status === "New Enquiry" ? "Contacted" : r.status
  ) as LeadStage;
  next = upsert(next, {
    ...r,
    patientId: patient.id,
    status: stage,
    lead: {
      ...r.lead,
      convertedAt: DEMO_DATE,
      events: [
        ...r.lead.events,
        event(
          stage,
          reuseId ? "Existing patient linked" : "Converted to patient",
          patient.id,
          r.lead.assignedTo,
        ),
      ],
    },
  });
  return {
    state: addActivity(
      next,
      `${r.name}: enquiry linked to ${patient.id}${reuseId ? " using the existing patient" : " after registration"}.`,
      patient.id,
    ),
    patient,
  };
}
export function linkLeadBooking(
  s: ClinicState,
  id: string,
  appointmentId: string,
) {
  const r = s.records["Leads & Enquiries"].find((r) => r.id === id),
    a = s.appointments.find((a) => a.id === appointmentId);
  if (!r?.lead || !a || a.patientId !== r.patientId)
    throw new Error("Choose an appointment for the linked patient.");
  if (["Won", "Lost"].includes(r.status))
    throw new Error("Reopen this enquiry before linking an appointment.");
  return upsert(s, {
    ...r,
    status: "Consultation Booked",
    lead: {
      ...r.lead,
      appointmentId,
      events: [
        ...r.lead.events,
        event(
          "Consultation Booked",
          "Appointment linked",
          appointmentId,
          r.lead.assignedTo,
        ),
      ],
    },
  });
}
