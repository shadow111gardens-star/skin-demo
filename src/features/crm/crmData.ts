import { DEMO_DATE, type ClinicState, type RecordItem } from "../../data";
import { leadStages, type LeadStage } from "./model";
export function enrichCRM(s: ClinicState) {
  if (s.crmSchemaVersion === 1) return s;
  s.crmSchemaVersion = 1;
  s.analyticsConfiguration ||= { roomPlanningMinutes: 480 };
  const original = s.records["Leads & Enquiries"] || [];
  s.records["Leads & Enquiries"] = original.map((r, i) =>
    r.lead
      ? r
      : {
          ...r,
          status: leadStages.includes(r.status as LeadStage)
            ? r.status
            : r.status === "Contacted"
              ? "Contacted"
              : "New Enquiry",
          date: r.date || DEMO_DATE,
          lead: {
            phone: "91" + String(70010001 + i).padStart(8, "0"),
            email: "enquiry" + (i + 1) + "@example.test",
            treatmentId:
              s.records["Treatment Catalogue"][i === 0 ? 0 : 6]?.id ||
              s.records["Treatment Catalogue"][0].id,
            source: r.detail.split(" · ")[0] || "Website",
            assignedTo: "Riya Malhotra",
            createdDate: r.date || DEMO_DATE,
            lastContact:
              r.status === "Contacted" ? r.date || DEMO_DATE : undefined,
            nextFollowup: "2026-10-24",
            notes: "Fictional enquiry. Interested treatment: " + r.detail,
            contacts:
              r.status === "Contacted"
                ? [
                    {
                      id: "opening-contact-" + r.id,
                      date: r.date || DEMO_DATE,
                      method: "Phone",
                      outcome: "Reached",
                      employee: "Riya Malhotra",
                      note: "Fictional opening contact record",
                    },
                  ]
                : [],
            events: [
              {
                id: "opening-" + r.id,
                at: "2026-10-23T08:00:00+05:30",
                date: r.date || DEMO_DATE,
                action: "Fictional opening enquiry",
                note: r.detail,
                employee: "Demo CRM",
                stage: r.status === "Contacted" ? "Contacted" : "New Enquiry",
              },
            ],
          },
        },
  );
  const seeds: [string, string, string, LeadStage, string, string?, string?][] =
    [
      [
        "crm-lead-booked",
        "Priya Patel",
        "9876543212",
        "Consultation Booked",
        "2026-10-20",
        "MM-1043",
        "APT-203",
      ],
      [
        "crm-lead-consult",
        "Ishita Menon",
        "9170010003",
        "Consultation Completed",
        "2026-10-18",
      ],
      [
        "crm-lead-proposed",
        "Dev Shah",
        "9170010004",
        "Treatment Proposed",
        "2026-10-17",
      ],
      [
        "crm-lead-purchased",
        "Ananya Sharma",
        "9876543210",
        "Package Purchased",
        "2026-10-16",
        "MM-1041",
      ],
      [
        "crm-lead-followup",
        "Tanvi Rao",
        "9170010006",
        "Follow-up Required",
        "2026-10-19",
      ],
      [
        "crm-lead-won",
        "Meera Iyer",
        "9876543214",
        "Won",
        "2026-10-15",
        "MM-1045",
      ],
      ["crm-lead-lost", "Kabir Sethi", "9170010008", "Lost", "2026-10-12"],
      [
        "crm-lead-returning",
        "Rohan Mehta",
        "9876543211",
        "New Enquiry",
        "2026-10-23",
      ],
    ];
  for (const [
    id,
    name,
    mobile,
    status,
    date,
    patientId,
    appointmentId,
  ] of seeds) {
    if (s.records["Leads & Enquiries"].some((r) => r.id === id)) continue;
    const p = s.patients.find((p) => p.id === patientId);
    const lastContact = status === "New Enquiry" ? undefined : "2026-10-22";
    const treatment =
      s.records["Treatment Catalogue"][status === "Package Purchased" ? 0 : 2];
    const lead: RecordItem = {
      id,
      name,
      patientId,
      amount: status === "Lost" ? 0 : 7200,
      date,
      detail: "Fictional CRM enquiry · staff-entered stage",
      status,
      lead: {
        phone: p?.phone || mobile,
        email:
          p?.email || name.toLowerCase().replaceAll(" ", ".") + "@example.test",
        treatmentId: treatment.id,
        source: ["Website", "Referral", "Instagram"][
          seeds.findIndex((v) => v[0] === id) % 3
        ],
        assignedTo:
          status === "Follow-up Required" ? "Aarav Singh" : "Riya Malhotra",
        createdDate: date,
        lastContact,
        nextFollowup: ["Won", "Lost", "Package Purchased"].includes(status)
          ? undefined
          : status === "Follow-up Required"
            ? "2026-10-22"
            : "2026-10-25",
        notes:
          status === "Lost"
            ? "Patient chose not to proceed; fictional closure."
            : "Fictional enquiry. CRM stage is staff-entered; operational metrics use linked records.",
        appointmentId,
        convertedAt: patientId ? date : undefined,
        contacts: lastContact
          ? [
              {
                id: "contact-" + id,
                date: lastContact,
                method: "Phone",
                outcome: "Reached",
                employee: "Riya Malhotra",
                note: "Fictional manually logged conversation.",
              },
            ]
          : [],
        events: [
          {
            id: "seed-" + id,
            at: date + "T09:00:00+05:30",
            date,
            action: "Opening lead record",
            note: "Fictional staff-entered stage; no external contact performed.",
            employee: "Demo CRM",
            stage: status,
          },
        ],
      },
    };
    s.records["Leads & Enquiries"].push(lead);
  }
  return s;
}
