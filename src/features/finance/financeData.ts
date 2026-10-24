import { DEMO_DATE, type ClinicState, type RecordItem } from "../../data";
import { syncFinance } from "./ledger";
export function enrichFinance(s: ClinicState) {
  if (s.financeSchemaVersion === 1) return syncFinance(s);
  s.financeSchemaVersion = 1;
  s.taxConfiguration ||= [
    {
      id: "tax-demo",
      name: "Clinic configured tax (example)",
      rate: 0,
      active: true,
    },
  ];
  s.records["Package Catalogue"] ||= [];
  for (const t of s.records["Treatment Catalogue"].slice(0, 6))
    if (!s.records["Package Catalogue"].some((r) => r.id === "package-" + t.id))
      s.records["Package Catalogue"].push({
        id: "package-" + t.id,
        name: t.name + " care package",
        detail: "Configurable fictional clinic offer",
        status: "Active",
        amount: t.treatment!.packagePrice,
        packageConfig: {
          treatmentId: t.id,
          area: "Any clinician-approved area",
          sessions: t.treatment!.sessions,
          price: t.treatment!.individualPrice * t.treatment!.sessions,
          discount:
            t.treatment!.individualPrice * t.treatment!.sessions -
            t.treatment!.packagePrice,
          validityDays: t.treatment!.validityDays,
          terms:
            "Fictional clinic terms. Sessions require an approved plan; expiry and refunds are documented separately.",
        },
      });
  for (const r of s.records["Packages & Billing"])
    if (!r.invoice) {
      r.invoice = {
        number:
          r.name.match(/INV-\d{4}-\d+/)?.[0] ||
          "MMV-2026-" + r.id.toUpperCase(),
        state:
          r.status === "Cancelled"
            ? "Void"
            : r.status === "Draft"
              ? "Draft"
              : "Issued",
        issueDate: r.date || DEMO_DATE,
        dueDate: r.dueDate || DEMO_DATE,
        lines: [
          {
            id: "line-" + r.id,
            kind: r.courseId ? "Package" : "Procedure",
            description: r.detail,
            quantity: 1,
            price: r.amount,
            discount: 0,
            taxIds: [],
          },
        ],
        discount: 0,
        taxes: [],
        notes: "Fictional migrated clinic invoice; no tax treatment assumed.",
        events: [
          {
            id: "opening-" + r.id,
            at: "2026-10-23T08:00:00+05:30",
            action: "Opening invoice record",
            note: "Fictional demo migration",
          },
        ],
      };
    }
  for (const p of s.records.Payments)
    if (!p.payment) {
      const invoice = s.records["Packages & Billing"].find(
        (i) => i.patientId === p.patientId && i.status === "Paid",
      );
      p.payment = {
        kind: "Receipt",
        invoiceId: invoice?.id,
        method: p.detail.includes("Card") ? "Card" : "UPI",
        reference: "DEMO-" + p.id,
        note: "Fictional opening receipt",
        createdAt: (p.date || DEMO_DATE) + "T09:00:00+05:30",
        requestId: "opening-" + p.id,
      };
    }
  for (const i of s.records["Packages & Billing"])
    if (
      i.status === "Paid" &&
      !s.records.Payments.some((p) => p.payment?.invoiceId === i.id)
    ) {
      s.records.Payments.push({
        id: "finance-opening-" + i.id,
        name:
          s.patients.find((p) => p.id === i.patientId)?.name || "Demo patient",
        detail: "Explicit migrated opening settlement",
        status: "Received",
        patientId: i.patientId,
        courseId: i.courseId,
        date: i.date || DEMO_DATE,
        amount: i.invoice!.lines[0].price,
        payment: {
          kind: "Receipt",
          invoiceId: i.id,
          method: "Other",
          reference: "OPENING-" + i.id,
          note: "Historical fictional settlement retained",
          createdAt: (i.date || DEMO_DATE) + "T08:00:00+05:30",
          requestId: "opening-" + i.id,
        },
      });
    }
  const drafts: RecordItem[] = [
    {
      id: "invoice-demo-draft",
      name: "Consultation draft",
      patientId: "MM-1046",
      date: DEMO_DATE,
      dueDate: "2026-10-30",
      detail: "Fictional consultation estimate, not issued",
      status: "Draft",
      amount: 0,
      invoice: {
        number: "DRAFT-MMV-2026-001",
        state: "Draft",
        issueDate: DEMO_DATE,
        dueDate: "2026-10-30",
        lines: [
          {
            id: "draft-line",
            kind: "Consultation",
            description: "Clinic consultation",
            quantity: 1,
            price: 1500,
            discount: 0,
            taxIds: [],
          },
        ],
        discount: 0,
        taxes: [],
        notes: "Fictional estimate pending issue.",
        events: [],
      },
    },
  ];
  for (const d of drafts)
    if (!s.records["Packages & Billing"].some((i) => i.id === d.id))
      s.records["Packages & Billing"].push(d);
  return syncFinance(s);
}
