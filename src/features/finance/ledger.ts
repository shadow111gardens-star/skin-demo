import { formatINR } from "../../format";
import { DEMO_DATE, type ClinicState, type RecordItem } from "../../data";
import type { InvoiceData } from "./model";
export const round = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;
export const inr = formatINR;
export function invoiceTotals(d: InvoiceData) {
  const gross = round(d.lines.reduce((n, l) => n + l.quantity * l.price, 0)),
    lineDiscount = round(d.lines.reduce((n, l) => n + l.discount, 0)),
    subtotal = round(gross - lineDiscount),
    net = round(subtotal - d.discount);
  const taxes = d.taxes.map((t) => ({
    id: t.id,
    name: t.name,
    rate: t.rate,
    amount: round(
      (d.lines.reduce(
        (n, l) =>
          n +
          (l.taxIds.includes(t.id)
            ? Math.max(0, l.quantity * l.price - l.discount) *
              (subtotal ? net / subtotal : 0)
            : 0),
        0,
      ) *
        t.rate) /
        100,
    ),
  }));
  return {
    gross,
    lineDiscount,
    subtotal,
    discount: d.discount,
    net,
    taxes,
    tax: round(taxes.reduce((n, t) => n + t.amount, 0)),
    total: round(net + taxes.reduce((n, t) => n + t.amount, 0)),
  };
}
export function invoicePaid(s: ClinicState, id: string, asOf = "9999-12-31") {
  return round(
    s.records.Payments.filter(
      (p) => p.payment?.invoiceId === id && (p.date || "") <= asOf,
    ).reduce(
      (n, p) => n + (p.payment?.kind === "Refund" ? -p.amount : p.amount),
      0,
    ),
  );
}
export function invoiceBalance(
  s: ClinicState,
  r: RecordItem,
  asOf = "9999-12-31",
) {
  if (!r.invoice) return r.status === "Paid" ? 0 : r.amount;
  if (r.invoice.state !== "Issued") return 0;
  return round(
    Math.max(0, invoiceTotals(r.invoice).total - invoicePaid(s, r.id, asOf)),
  );
}
export function invoiceStatus(s: ClinicState, r: RecordItem, date = DEMO_DATE) {
  if (!r.invoice) return r.status;
  if (r.invoice.state !== "Issued") return r.invoice.state;
  const balance = invoiceBalance(s, r, date);
  if (!balance) return "Paid";
  if (r.invoice.dueDate < date) return "Overdue";
  return invoicePaid(s, r.id, date) > 0 ? "Partially paid" : "Issued";
}
export function financeSummary(
  s: ClinicState,
  from: string,
  to: string,
  status = "All",
) {
  const invoices = s.records["Packages & Billing"].filter(
    (r) =>
      r.invoice &&
      r.invoice.issueDate >= from &&
      r.invoice.issueDate <= to &&
      (status === "All" ||
        (status === "Outstanding"
          ? r.invoice.state === "Issued" && invoiceBalance(s, r, to) > 0
          : invoiceStatus(s, r, to) === status)),
  );
  const issued = invoices.filter((r) => r.invoice?.state === "Issued");
  const payments = s.records.Payments.filter(
    (p) =>
      p.payment &&
      (p.date || "") >= from &&
      (p.date || "") <= to &&
      (status === "All" || invoices.some((i) => i.id === p.payment?.invoiceId)),
  );
  const receipts = round(
      payments
        .filter((p) => p.payment?.kind === "Receipt")
        .reduce((n, p) => n + p.amount, 0),
    ),
    refunds = round(
      payments
        .filter((p) => p.payment?.kind === "Refund")
        .reduce((n, p) => n + p.amount, 0),
    );
  return {
    invoices,
    payments,
    receipts,
    refunds,
    collections: round(receipts - refunds),
    billed: round(
      issued.reduce((n, r) => n + invoiceTotals(r.invoice!).total, 0),
    ),
    outstanding: round(
      issued.reduce((n, r) => n + invoiceBalance(s, r, to), 0),
    ),
    packageSales: round(
      issued.reduce(
        (n, r) =>
          n +
          r
            .invoice!.lines.filter((l) => l.kind === "Package")
            .reduce(
              (a, l) =>
                a +
                (l.quantity * l.price - l.discount) *
                  (invoiceTotals(r.invoice!).subtotal
                    ? invoiceTotals(r.invoice!).net /
                      invoiceTotals(r.invoice!).subtotal
                    : 0),
              0,
            ),
        0,
      ),
    ),
    projected: round(
      invoices
        .filter((r) => r.invoice?.state === "Draft")
        .reduce((n, r) => n + invoiceTotals(r.invoice!).total, 0),
    ),
    overdue: issued.filter((r) => invoiceStatus(s, r, to) === "Overdue").length,
  };
}
export function accountCredit(s: ClinicState, patientId: string) {
  return round(
    s.records.Payments.filter(
      (p) => p.patientId === patientId && !p.payment?.invoiceId,
    ).reduce(
      (n, p) => n + (p.payment?.kind === "Refund" ? -p.amount : p.amount),
      0,
    ),
  );
}
export function syncFinance(s: ClinicState): ClinicState {
  const invoices = s.records["Packages & Billing"].map((r) =>
    r.invoice
      ? {
          ...r,
          amount: invoiceBalance(s, r),
          status:
            r.invoice.state === "Draft"
              ? "Draft"
              : r.invoice.state === "Void"
                ? "Void"
                : invoiceBalance(s, r) === 0
                  ? "Paid"
                  : invoicePaid(s, r.id) > 0
                    ? "Partially paid"
                    : "Pending",
        }
      : r,
  );
  return {
    ...s,
    records: {
      ...s.records,
      "Packages & Billing": invoices,
      "Treatment Plans": s.records["Treatment Plans"].map((r) =>
        r.course
          ? {
              ...r,
              amount: round(
                invoices
                  .filter(
                    (i) =>
                      i.courseId === r.id &&
                      (!i.invoice || i.invoice.state === "Issued"),
                  )
                  .reduce((n, i) => n + i.amount, 0),
              ),
            }
          : r,
      ),
    },
  };
}
export function packageState(r: RecordItem, date = DEMO_DATE) {
  if (r.status === "Cancelled" || r.status === "Paused") return r.status;
  if (r.course?.validUntil && r.course.validUntil < date) return "Expired";
  if ((r.completedSittings || 0) >= (r.totalSittings || 1)) return "Exhausted";
  if (
    r.course?.validUntil &&
    r.course.validUntil <=
      new Date(new Date(date + "T12:00:00Z").getTime() + 14 * 86400000)
        .toISOString()
        .slice(0, 10)
  )
    return "Expiring";
  return "Active";
}
export function courseInvoice(
  id: string,
  patientId: string,
  courseId: string,
  description: string,
  total: number,
): RecordItem {
  return {
    id,
    name: "Invoice · " + description,
    detail: "Fictional course purchase · no payment collected",
    patientId,
    courseId,
    date: DEMO_DATE,
    dueDate: DEMO_DATE,
    status: total ? "Pending" : "Paid",
    amount: total,
    invoice: {
      number:
        "MMV-" +
        DEMO_DATE.slice(0, 4) +
        "-" +
        id.replace("invoice-", "").toUpperCase(),
      state: "Issued",
      issueDate: DEMO_DATE,
      dueDate: DEMO_DATE,
      lines: [
        {
          id: "line-" + id,
          kind: "Package",
          description,
          quantity: 1,
          price: total,
          discount: 0,
          taxIds: [],
        },
      ],
      discount: 0,
      taxes: [],
      notes:
        "Approved course purchase. Taxes require explicit clinic configuration.",
      events: [
        {
          id: "issue-" + id,
          at: new Date().toISOString(),
          action: "Issued with course conversion",
          note: "No payment gateway or automatic charge",
        },
      ],
    },
  };
}
