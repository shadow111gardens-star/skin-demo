import { beforeEach, describe, it, expect } from "vitest";
import {
  resetState,
  readState,
  saveState,
  DEMO_DATE,
  type RecordItem,
} from "../../data";
import {
  saveLead,
  changeLeadStage,
  logLeadContact,
  convertLead,
  linkLeadBooking,
  leadMatches,
  type ConversionFields,
} from "./services";
const fields: ConversionFields = {
  name: "Nisha Demo",
  phone: "9000011223",
  email: "nisha.demo@example.test",
  dob: "1995-02-03",
  doctor: "Dr. Mehta",
  gender: "Female",
  address: "Fictional Bengaluru address",
  preference: "Phone",
  consent: "Pending",
};
function newLead(): RecordItem {
  const r = structuredClone(resetState().records["Leads & Enquiries"][0]);
  return {
    ...r,
    id: "crm-test",
    name: fields.name,
    patientId: undefined,
    status: "New Enquiry",
    amount: 12000,
    date: DEMO_DATE,
    lead: {
      ...r.lead!,
      phone: fields.phone,
      email: fields.email,
      createdDate: DEMO_DATE,
      notes: "Fictional enquiry",
      events: [],
      contacts: [],
      lastContact: undefined,
      nextFollowup: "2026-10-24",
      convertedAt: undefined,
    },
  };
}
beforeEach(() => localStorage.clear());
describe("shared enquiry CRM", () => {
  it("migrates every pipeline stage and preserves original lead identities and patient counts", () => {
    const s = resetState();
    expect(
      s.records["Leads & Enquiries"].find((r) => r.id === "leads-enquiries-1")
        ?.lead,
    ).toBeDefined();
    expect(
      new Set(s.records["Leads & Enquiries"].map((r) => r.status)).size,
    ).toBe(9);
    expect(s.patients).toHaveLength(6);
    saveState(s);
    expect(readState().records["Leads & Enquiries"]).toEqual(
      s.records["Leads & Enquiries"],
    );
  });
  it("creates/edits one enquiry, validates contacts and blocks duplicate lead mobile/email", () => {
    let s = saveLead(resetState(), newLead());
    expect(s.records["Leads & Enquiries"][0].status).toBe("New Enquiry");
    expect(() => saveLead(s, { ...newLead(), id: "duplicate" })).toThrow(
      /already has an enquiry/,
    );
    expect(() =>
      saveLead(s, {
        ...newLead(),
        id: "bad",
        lead: { ...newLead().lead!, phone: "123" },
      }),
    ).toThrow(/valid Indian/);
    const old = s.records["Leads & Enquiries"][0];
    s = saveLead(s, {
      ...old,
      name: "Nisha Updated",
      status: "Won",
      lead: { ...old.lead!, notes: "Updated source notes" },
    });
    expect(s.records["Leads & Enquiries"][0].name).toBe("Nisha Updated");
    expect(s.records["Leads & Enquiries"][0].status).toBe("New Enquiry");
  });
  it("requires confirmation for closing/reopening and retains a stage audit", () => {
    let s = saveLead(resetState(), newLead());
    expect(() =>
      changeLeadStage(
        s,
        "crm-test",
        "Lost",
        "No longer interested",
        "Riya",
        false,
      ),
    ).toThrow(/Confirm/);
    s = changeLeadStage(
      s,
      "crm-test",
      "Lost",
      "No longer interested",
      "Riya",
      true,
    );
    expect(
      s.records["Leads & Enquiries"][0].lead?.nextFollowup,
    ).toBeUndefined();
    expect(() => convertLead(s, "crm-test", fields)).toThrow(/Reopen/);
    s = changeLeadStage(
      s,
      "crm-test",
      "Contacted",
      "Patient returned",
      "Riya",
      true,
    );
    expect(s.records["Leads & Enquiries"][0].lead?.events.at(-1)?.stage).toBe(
      "Contacted",
    );
  });
  it("logs contact once, updates next follow-up and does not send anything", () => {
    let s = saveLead(resetState(), newLead());
    const contact = {
      id: "contact-id",
      date: DEMO_DATE,
      method: "Phone",
      outcome: "Requested callback",
      employee: "Riya",
      note: "Fictional callback requested",
    };
    s = logLeadContact(s, "crm-test", contact, "2026-10-25");
    const r = s.records["Leads & Enquiries"][0];
    expect(r.status).toBe("Contacted");
    expect(r.lead?.lastContact).toBe(DEMO_DATE);
    expect(r.lead?.nextFollowup).toBe("2026-10-25");
    expect(logLeadContact(s, "crm-test", contact, "2026-10-25")).toBe(s);
    expect(() =>
      logLeadContact(
        s,
        "crm-test",
        { ...contact, id: "bad", date: "2026-10-24" },
        "2026-10-25",
      ),
    ).toThrow(/contact date/);
  });
  it("converts with required patient fields, links the lead and prevents repeated registration", () => {
    const s = saveLead(resetState(), newLead());
    expect(() => convertLead(s, "crm-test", { ...fields, dob: "" })).toThrow(
      /date of birth/,
    );
    const result = convertLead(s, "crm-test", fields);
    expect(result.state.patients).toHaveLength(7);
    expect(result.patient.name).toBe(fields.name);
    expect(result.patient.referralSource).toBe(newLead().lead?.source);
    const r = result.state.records["Leads & Enquiries"].find(
      (r) => r.id === "crm-test",
    )!;
    expect(r.patientId).toBe(result.patient.id);
    expect(r.status).toBe("Contacted");
    expect(convertLead(result.state, "crm-test", fields).state).toBe(
      result.state,
    );
  });
  it("reuses a matching patient and blocks creating a second patient even after editing conversion fields", () => {
    const s = resetState(),
      r = s.records["Leads & Enquiries"].find(
        (r) => r.id === "crm-lead-returning",
      )!,
      p = s.patients.find((p) => p.id === "MM-1042")!;
    expect(leadMatches(s, r).map((p) => p.id)).toContain(p.id);
    expect(() =>
      convertLead(s, r.id, { ...fields, phone: p.phone, email: p.email || "" }),
    ).toThrow(/Reuse/);
    expect(() => convertLead(s, r.id, fields)).toThrow(/Reuse/);
    const result = convertLead(s, r.id, fields, p.id);
    expect(result.state.patients).toHaveLength(6);
    expect(
      result.state.records["Leads & Enquiries"].find((v) => v.id === r.id)
        ?.patientId,
    ).toBe(p.id);
    expect(result.patient).toEqual(p);
  });
  it("rejects unrelated/archived reuse and links actual bookings only for the correct patient", () => {
    let s = resetState();
    const r = s.records["Leads & Enquiries"].find(
      (r) => r.id === "crm-lead-returning",
    )!;
    expect(() => convertLead(s, r.id, fields, "MM-1041")).toThrow(/matching/);
    const converted = convertLead(s, r.id, fields, "MM-1042");
    s = linkLeadBooking(converted.state, r.id, "APT-202");
    expect(
      s.records["Leads & Enquiries"].find((v) => v.id === r.id)?.status,
    ).toBe("Consultation Booked");
    expect(() => linkLeadBooking(s, r.id, "APT-201")).toThrow(/linked patient/);
    s.patients.find((p) => p.id === "MM-1042")!.status = "Archived";
    const fresh = resetState();
    fresh.patients.find((p) => p.id === "MM-1042")!.status = "Archived";
    expect(() => convertLead(fresh, r.id, fields, "MM-1042")).toThrow(
      /restore archived/,
    );
  });
});
