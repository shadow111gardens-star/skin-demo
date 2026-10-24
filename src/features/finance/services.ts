import { DEMO_DATE, type ClinicState, type RecordItem } from "../../data";
import { safeDate } from "../../services";
import { addActivity } from "../../store";
import {
  invoiceTotals,
  invoiceBalance,
  invoicePaid,
  round,
  syncFinance,
} from "./ledger";
import {
  methods,
  lineKinds,
  type InvoiceData,
  type PaymentData,
  type TaxConfig,
} from "./model";
const validDate = (v: string) => !!v && safeDate(v) === v;
const positive = (n: number) => Number.isFinite(n) && n > 0;
const nonnegative = (n: number) => Number.isFinite(n) && n >= 0;
const upsert = (s: ClinicState, key: string, r: RecordItem) => ({
  ...s,
  records: {
    ...s.records,
    [key]: s.records[key].some((v) => v.id === r.id)
      ? s.records[key].map((v) => (v.id === r.id ? r : v))
      : [r, ...s.records[key]],
  },
});
const event = (action: string, note: string) => ({
  id: crypto.randomUUID(),
  at: new Date().toISOString(),
  action,
  note,
});
export function saveInvoice(
  s: ClinicState,
  r: RecordItem,
  issue = false,
  confirmed = false,
) {
  const old = s.records["Packages & Billing"].find((v) => v.id === r.id),
    d = r.invoice;
  if (old?.invoice?.state && old.invoice.state !== "Draft")
    throw new Error("Issued and void invoices are read-only.");
  if (
    !d ||
    !s.patients.some((p) => p.id === r.patientId && p.status !== "Archived")
  )
    throw new Error("Select an existing active patient.");
  if (
    !validDate(d.issueDate) ||
    !validDate(d.dueDate) ||
    d.dueDate < d.issueDate
  )
    throw new Error(
      "Enter valid issue/due dates; due date cannot precede issue date.",
    );
  if (issue && d.issueDate > DEMO_DATE)
    throw new Error(
      "An issued invoice cannot be future dated beyond the demo operating day.",
    );
  if (!d.lines.length) throw new Error("Add at least one invoice line.");
  for (const l of d.lines) {
    if (
      !lineKinds.includes(l.kind) ||
      !l.description.trim() ||
      !positive(l.quantity) ||
      !nonnegative(l.price) ||
      !nonnegative(l.discount) ||
      l.discount > round(l.quantity * l.price)
    )
      throw new Error(
        "Each line needs a description, positive quantity, non-negative price and discount within the line value.",
      );
    if (l.taxIds.some((id) => !d.taxes.some((t) => t.id === id)))
      throw new Error("Choose a configured tax for every selected tax line.");
  }
  if (new Set(d.lines.map((l) => l.id)).size !== d.lines.length)
    throw new Error("Duplicate line identity.");
  validateTaxes(d.taxes);
  if (
    !nonnegative(d.discount) ||
    d.discount > invoiceTotals({ ...d, discount: 0 }).subtotal
  )
    throw new Error("Invoice discount cannot exceed the subtotal.");
  if (!Number.isFinite(invoiceTotals(d).total) || invoiceTotals(d).total < 0)
    throw new Error("Invoice values exceed the supported numeric range.");
  if (issue && !confirmed)
    throw new Error("Confirm invoice issue before saving.");
  const count = s.records["Packages & Billing"].length + 1;
  let number =
    old?.invoice?.number || "MMV-2026-" + String(count).padStart(4, "0");
  if (issue) number = number.replace(/^DRAFT-/, "");
  else if (!number.startsWith("DRAFT-")) number = "DRAFT-" + number;
  if (
    s.records["Packages & Billing"].some(
      (v) => v.id !== r.id && v.invoice?.number === number,
    )
  )
    throw new Error("Invoice number already exists.");
  const invoice: InvoiceData = {
    ...d,
    number,
    state: issue ? "Issued" : "Draft",
    events: [
      ...(old?.invoice?.events || []),
      event(issue ? "Invoice issued" : "Draft saved", d.notes),
    ],
  };
  return syncFinance(
    addActivity(
      upsert(s, "Packages & Billing", {
        ...r,
        name: number,
        detail: d.lines.map((l) => l.description).join(" · "),
        date: d.issueDate,
        dueDate: d.dueDate,
        invoice,
        status: issue ? "Pending" : "Draft",
        amount: issue ? invoiceTotals(invoice).total : 0,
      }),
      `${number}: ${issue ? "issued; no money collected" : "draft saved"}.`,
      r.patientId,
    ),
  );
}
export function issueInvoice(s: ClinicState, id: string, confirmed: boolean) {
  const r = s.records["Packages & Billing"].find((v) => v.id === id);
  if (!r?.invoice) throw new Error("Invoice not found.");
  return saveInvoice(s, r, true, confirmed);
}
export function voidInvoice(
  s: ClinicState,
  id: string,
  reason: string,
  confirmed: boolean,
) {
  const r = s.records["Packages & Billing"].find((v) => v.id === id);
  if (!r?.invoice || r.invoice.state === "Void")
    throw new Error("Choose a draft or issued invoice.");
  if (!reason.trim() || !confirmed)
    throw new Error("Enter a reason and confirm voiding.");
  if (invoicePaid(s, id) > 0)
    throw new Error(
      "Record explicit refunds for all applied receipts before voiding this invoice.",
    );
  return syncFinance(
    addActivity(
      upsert(s, "Packages & Billing", {
        ...r,
        invoice: {
          ...r.invoice,
          state: "Void",
          voidReason: reason,
          events: [...r.invoice.events, event("Invoice voided", reason)],
        },
        status: "Void",
        amount: 0,
      }),
      `${r.invoice.number}: voided. ${reason}`,
      r.patientId,
    ),
  );
}
export interface PaymentInput {
  id: string;
  patientId: string;
  invoiceId?: string;
  amount: number;
  date: string;
  method: PaymentData["method"];
  reference: string;
  note: string;
  refundOf?: string;
}
export function recordFinancePayment(
  s: ClinicState,
  input: PaymentInput,
  confirmed: boolean,
) {
  const retry = s.records.Payments.find(
    (p) => p.payment?.requestId === input.id || p.id === input.id,
  );
  if (retry) {
    if (
      retry.patientId === input.patientId &&
      retry.amount === input.amount &&
      retry.payment?.invoiceId === input.invoiceId &&
      retry.payment?.refundOf === input.refundOf
    )
      return s;
    throw new Error(
      "This payment request was already used with different details.",
    );
  }
  if (!confirmed)
    throw new Error("Confirm the simulated ledger entry before saving.");
  if (!s.patients.some((p) => p.id === input.patientId))
    throw new Error("Select a registered patient.");
  if (!positive(input.amount) || round(input.amount) !== input.amount)
    throw new Error("Enter a positive amount with at most two decimal places.");
  if (!validDate(input.date) || input.date > DEMO_DATE)
    throw new Error(
      "Enter a valid payment date on or before the demo operating day.",
    );
  if (!methods.includes(input.method))
    throw new Error("Select a payment method.");
  if (!input.note.trim()) throw new Error("Record a payment / refund note.");
  if (
    ["UPI", "Card", "Bank Transfer"].includes(input.method) &&
    !input.reference.trim()
  )
    throw new Error("Record a transaction reference for this method.");
  let invoiceId = input.invoiceId,
    courseId: string | undefined;
  const original = input.refundOf
    ? s.records.Payments.find((p) => p.id === input.refundOf)
    : undefined;
  if (input.refundOf) {
    if (
      !original?.payment ||
      original.payment.kind !== "Receipt" ||
      original.patientId !== input.patientId
    )
      throw new Error("Select an original receipt for this patient.");
    if (input.date < (original.date || ""))
      throw new Error("Refund date cannot precede the original receipt.");
    const refunded = s.records.Payments.filter(
      (p) => p.payment?.refundOf === original.id,
    ).reduce((n, p) => n + p.amount, 0);
    if (input.amount > round(original.amount - refunded))
      throw new Error("Refund exceeds the unrefunded amount on this receipt.");
    invoiceId = original.payment.invoiceId;
    courseId = original.courseId;
  } else if (invoiceId) {
    const r = s.records["Packages & Billing"].find(
      (r) => r.id === invoiceId && r.patientId === input.patientId,
    );
    if (!r?.invoice || r.invoice.state !== "Issued")
      throw new Error("Select an issued invoice belonging to this patient.");
    if (input.date < r.invoice.issueDate)
      throw new Error(
        "Invoice payment date cannot precede its issue date. Record an on-account deposit instead.",
      );
    if (input.amount > invoiceBalance(s, r))
      throw new Error(
        "Amount exceeds this invoice balance. Record excess as a separate on-account deposit.",
      );
    courseId = r.courseId;
  }
  if (
    input.refundOf &&
    s.records.Payments.some(
      (p) =>
        p.payment?.kind === "Refund" &&
        p.payment.refundOf === input.refundOf &&
        p.date === input.date &&
        p.amount === input.amount &&
        p.payment.method === input.method &&
        p.payment.reference.toLowerCase() ===
          input.reference.trim().toLowerCase(),
    )
  )
    throw new Error(
      "Possible duplicate refund. Review the existing refund; use a distinct documented reference for a separate refund.",
    );
  if (
    !input.refundOf &&
    s.records.Payments.some(
      (p) =>
        p.payment?.kind === "Receipt" &&
        ((input.reference.trim() &&
          p.payment.reference.toLowerCase() ===
            input.reference.trim().toLowerCase()) ||
          (!input.reference.trim() &&
            p.patientId === input.patientId &&
            p.payment.invoiceId === invoiceId &&
            p.date === input.date &&
            p.amount === input.amount &&
            p.payment.method === input.method)),
    )
  )
    throw new Error(
      "Possible duplicate payment. Review the existing receipt; use a distinct documented reference only for a separate payment.",
    );
  const patient = s.patients.find((p) => p.id === input.patientId)!;
  const r: RecordItem = {
    id: input.id,
    name: patient.name,
    patientId: input.patientId,
    courseId,
    date: input.date,
    amount: input.amount,
    status: input.refundOf ? "Refunded" : "Received",
    detail: `${input.refundOf ? "Refund" : "Receipt"} · ${input.method} · ${input.reference || "No external reference"} · ${input.note}`,
    payment: {
      kind: input.refundOf ? "Refund" : "Receipt",
      invoiceId,
      refundOf: input.refundOf,
      method: input.method,
      reference: input.reference.trim(),
      note: input.note,
      createdAt: new Date().toISOString(),
      requestId: input.id,
    },
  };
  return syncFinance(
    addActivity(
      upsert(s, "Payments", r),
      `${patient.name}: demo ${input.refundOf ? "refund" : "receipt"} of INR ${input.amount} recorded${invoiceId ? " against invoice" : " on account"}. No external payment processed.`,
      patient.id,
    ),
  );
}
export function savePackage(s: ClinicState, r: RecordItem) {
  const d = r.packageConfig;
  if (
    !d ||
    !r.name.trim() ||
    !s.records["Treatment Catalogue"].some((t) => t.id === d.treatmentId) ||
    !d.area.trim() ||
    !Number.isInteger(d.sessions) ||
    d.sessions < 1 ||
    d.sessions > 100 ||
    !Number.isInteger(d.validityDays) ||
    d.validityDays < 1 ||
    d.validityDays > 3650 ||
    !nonnegative(d.price) ||
    !nonnegative(d.discount) ||
    d.discount > d.price ||
    !d.terms.trim() ||
    !["Active", "Inactive"].includes(r.status)
  )
    throw new Error(
      "Enter a name, treatment, area, 1–100 sessions, valid price/discount, 1–3650 validity days and terms.",
    );
  return addActivity(
    upsert(s, "Package Catalogue", {
      ...r,
      amount: round(d.price - d.discount),
      detail: d.terms,
    }),
    `${r.name}: package configuration saved. Existing purchases retain their agreed values.`,
  );
}
function validateTaxes(taxes: TaxConfig[]) {
  if (
    new Set(taxes.map((t) => t.id)).size !== taxes.length ||
    taxes.some((t) => !t.name.trim() || !nonnegative(t.rate) || t.rate > 100)
  )
    throw new Error(
      "Tax labels must be unique entries with rates between 0 and 100%.",
    );
}
export function saveTaxConfiguration(s: ClinicState, taxes: TaxConfig[]) {
  validateTaxes(taxes);
  return addActivity(
    { ...s, taxConfiguration: taxes },
    "Clinic tax configuration updated. Issued invoices retain their tax snapshots.",
  );
}
