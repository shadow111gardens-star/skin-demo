import { describe, it, expect, beforeEach } from "vitest";
import {
  resetState,
  saveState,
  readState,
  DEMO_DATE,
  type RecordItem,
  type ClinicState,
} from "../../data";
import { dashboardStats } from "../../services";
import { convertPlan, transitionPlan } from "../clinical/services";
import {
  reviewReady,
  sessionRecord,
  clinician,
} from "../sessions/testFixtures";
import { completeSession } from "../sessions/services";
import {
  invoiceTotals,
  invoicePaid,
  invoiceBalance,
  invoiceStatus,
  financeSummary,
  accountCredit,
  packageState,
} from "./ledger";
import {
  saveInvoice,
  issueInvoice,
  voidInvoice,
  recordFinancePayment,
  savePackage,
  saveTaxConfiguration,
  type PaymentInput,
} from "./services";
const invoice = (id = "test-invoice"): RecordItem => ({
  id,
  name: "Test invoice",
  patientId: "MM-1046",
  date: "2026-10-22",
  detail: "Fictional invoice",
  status: "Draft",
  amount: 0,
  invoice: {
    number: "",
    state: "Draft",
    issueDate: "2026-10-22",
    dueDate: "2026-10-30",
    lines: [
      {
        id: "line-1",
        kind: "Procedure",
        description: "Fictional procedure",
        quantity: 2,
        price: 1000,
        discount: 100,
        taxIds: ["tax-a"],
      },
      {
        id: "line-2",
        kind: "Consultation",
        description: "Fictional consultation",
        quantity: 1,
        price: 1000,
        discount: 0,
        taxIds: [],
      },
    ],
    discount: 290,
    taxes: [
      {
        id: "tax-a",
        name: "Clinic configured example",
        rate: 10,
        active: true,
      },
    ],
    notes: "Fictional explicit clinic tax configuration; not tax advice",
    events: [],
  },
});
function receipt(
  s: ClinicState,
  amount: number,
  id = "test-receipt",
): PaymentInput {
  const i = s.records["Packages & Billing"].find(
    (i) => i.id === "test-invoice",
  )!;
  return {
    id,
    patientId: i.patientId!,
    invoiceId: i.id,
    amount,
    date: DEMO_DATE,
    method: "UPI",
    reference: "DEMO-REF-" + id,
    note: "Fictional receipt",
  };
}
beforeEach(() => localStorage.clear());
describe("connected clinic finance ledger", () => {
  it("migrates existing invoice/payment identities without changing baseline collections or outstanding", () => {
    const s = resetState();
    expect(financeSummary(s, DEMO_DATE, DEMO_DATE)).toMatchObject({
      collections: 42000,
      outstanding: 24000,
      billed: 42000,
      projected: 1500,
    });
    expect(dashboardStats(s, DEMO_DATE)).toMatchObject({
      collections: 42000,
      outstanding: 24000,
    });
    saveState(s);
    expect(readState().records.Payments).toEqual(s.records.Payments);
    expect(readState().records["Packages & Billing"]).toEqual(
      s.records["Packages & Billing"],
    );
  });
  it("calculates line discounts, invoice discount and only explicitly selected taxes", () => {
    expect(invoiceTotals(invoice().invoice!)).toMatchObject({
      gross: 3000,
      lineDiscount: 100,
      subtotal: 2900,
      net: 2610,
      tax: 171,
      total: 2781,
    });
  });
  it("keeps drafts out of billed/receivables, issues with confirmation and freezes issued values", () => {
    let s = saveInvoice(resetState(), invoice());
    let r = s.records["Packages & Billing"].find(
      (r) => r.id === "test-invoice",
    )!;
    expect(invoiceStatus(s, r)).toBe("Draft");
    expect(invoiceBalance(s, r)).toBe(0);
    expect(() => recordFinancePayment(s, receipt(s, 100), true)).toThrow(
      /issued invoice/,
    );
    expect(() => issueInvoice(s, r.id, false)).toThrow(/Confirm/);
    s = issueInvoice(s, r.id, true);
    r = s.records["Packages & Billing"].find((r) => r.id === "test-invoice")!;
    expect(invoiceBalance(s, r)).toBe(2781);
    expect(invoiceStatus(s, r)).toBe("Issued");
    expect(() => saveInvoice(s, r)).toThrow(/read-only/);
    const changed = saveTaxConfiguration(s, [
      {
        id: "different",
        name: "Updated clinic default",
        rate: 7,
        active: true,
      },
    ]);
    expect(
      invoiceTotals(
        changed.records["Packages & Billing"].find((i) => i.id === r.id)!
          .invoice!,
      ).total,
    ).toBe(2781);
  });
  it("handles partial/full settlement, overpayment rejection and idempotent retries", () => {
    let s = saveInvoice(resetState(), invoice(), true, true);
    const input = receipt(s, 1000);
    s = recordFinancePayment(s, input, true);
    let r = s.records["Packages & Billing"].find(
      (r) => r.id === "test-invoice",
    )!;
    expect(invoicePaid(s, r.id)).toBe(1000);
    expect(invoiceBalance(s, r)).toBe(1781);
    expect(invoiceStatus(s, r)).toBe("Partially paid");
    expect(recordFinancePayment(s, input, true)).toBe(s);
    expect(() =>
      recordFinancePayment(s, { ...input, id: "another" }, true),
    ).toThrow(/duplicate/);
    expect(() =>
      recordFinancePayment(s, receipt(s, 1782, "over"), true),
    ).toThrow(/exceeds/);
    s = recordFinancePayment(s, receipt(s, 1781, "final"), true);
    r = s.records["Packages & Billing"].find((r) => r.id === "test-invoice")!;
    expect(invoiceStatus(s, r)).toBe("Paid");
    expect(r.amount).toBe(0);
  });
  it("records explicit refunds, reopens balance and retains original receipts; enforces refund limits", () => {
    let s = saveInvoice(resetState(), invoice(), true, true);
    s = recordFinancePayment(s, receipt(s, 2781), true);
    const refund = {
      ...receipt(s, 500, "refund-1"),
      refundOf: "test-receipt",
      note: "Fictional approved refund",
    };
    s = recordFinancePayment(s, refund, true);
    expect(invoicePaid(s, "test-invoice")).toBe(2281);
    expect(
      invoiceBalance(
        s,
        s.records["Packages & Billing"].find((i) => i.id === "test-invoice")!,
      ),
    ).toBe(500);
    expect(
      s.records.Payments.find((p) => p.id === "test-receipt")!.amount,
    ).toBe(2781);
    expect(
      s.records.Payments.find((p) => p.id === "refund-1")!.payment!.kind,
    ).toBe("Refund");
    expect(() =>
      recordFinancePayment(
        s,
        { ...refund, id: "refund-too-much", amount: 2282 },
        true,
      ),
    ).toThrow(/unrefunded/);
    expect(() => voidInvoice(s, "test-invoice", "Void", true)).toThrow(
      /refunds/,
    );
  });
  it("supports patient account deposits without silently settling invoices", () => {
    let s = resetState();
    const before = dashboardStats(s, DEMO_DATE).outstanding;
    s = recordFinancePayment(
      s,
      {
        id: "deposit",
        patientId: "MM-1042",
        amount: 2000,
        date: DEMO_DATE,
        method: "Cash",
        reference: "",
        note: "Fictional deposit",
      },
      true,
    );
    expect(accountCredit(s, "MM-1042")).toBe(2000);
    expect(dashboardStats(s, DEMO_DATE).outstanding).toBe(before);
    expect(dashboardStats(s, DEMO_DATE).collections).toBe(44000);
    s = recordFinancePayment(
      s,
      {
        id: "deposit-refund",
        patientId: "MM-1042",
        amount: 500,
        date: DEMO_DATE,
        method: "Cash",
        reference: "",
        note: "Fictional deposit refund",
        refundOf: "deposit",
      },
      true,
    );
    expect(accountCredit(s, "MM-1042")).toBe(1500);
  });
  it("rejects zero/negative amounts, wrong patients, missing references and unconfirmed entries", () => {
    const s = saveInvoice(resetState(), invoice(), true, true);
    for (const amount of [0, -1, NaN, 1.001])
      expect(() => recordFinancePayment(s, receipt(s, amount), true)).toThrow(
        /positive/,
      );
    expect(() =>
      recordFinancePayment(
        s,
        { ...receipt(s, 10), patientId: "MM-1041" },
        true,
      ),
    ).toThrow(/belonging/);
    expect(() =>
      recordFinancePayment(s, { ...receipt(s, 10), reference: "" }, true),
    ).toThrow(/reference/);
    expect(() => recordFinancePayment(s, receipt(s, 10), false)).toThrow(
      /Confirm/,
    );
  });
  it("voids drafts or unpaid issued invoices with reason and preserves the audit record", () => {
    let s = saveInvoice(resetState(), invoice());
    expect(() => voidInvoice(s, "test-invoice", "", true)).toThrow(/reason/);
    s = voidInvoice(s, "test-invoice", "Fictional cancelled estimate", true);
    const r = s.records["Packages & Billing"].find(
      (i) => i.id === "test-invoice",
    )!;
    expect(r.invoice?.state).toBe("Void");
    expect(invoiceBalance(s, r)).toBe(0);
    expect(r.invoice?.events.at(-1)?.action).toBe("Invoice voided");
  });
  it("derives date-filtered billed, receipts/refunds, historical balance and projection from the same ledger", () => {
    let s = saveInvoice(resetState(), invoice(), true, true);
    s = recordFinancePayment(
      s,
      { ...receipt(s, 1000), date: "2026-10-22" },
      true,
    );
    s = recordFinancePayment(
      s,
      { ...receipt(s, 200, "refund-on-23"), refundOf: "test-receipt" },
      true,
    );
    expect(financeSummary(s, "2026-10-22", "2026-10-22")).toMatchObject({
      billed: 2781,
      collections: 1000,
      outstanding: 1781,
      projected: 0,
    });
    expect(financeSummary(s, DEMO_DATE, DEMO_DATE).collections).toBe(41800);
    expect(
      invoiceBalance(
        s,
        s.records["Packages & Billing"].find((i) => i.id === "test-invoice")!,
        "2026-10-22",
      ),
    ).toBe(1781);
    expect(
      invoiceStatus(
        s,
        s.records["Packages & Billing"].find((i) => i.id === "test-invoice")!,
        "2026-11-01",
      ),
    ).toBe("Overdue");
  });
  it("selects only a matching package during conversion; creates one course/invoice with a retained price snapshot", () => {
    let s = resetState();
    const id = "proposal-MM-1043";
    s = transitionPlan(s, id, "Approved", "Dr. Mehta");
    const p = s.records["Plan Proposals"].find((r) => r.id === id)!.plan!,
      offer = s.records["Package Catalogue"].find(
        (r) => r.packageConfig!.treatmentId === p.treatmentId,
      )!;
    s = savePackage(s, {
      ...offer,
      packageConfig: { ...offer.packageConfig!, price: 8000, discount: 500 },
    });
    s = convertPlan(s, id, offer.id);
    const course = s.records["Treatment Plans"].find(
      (r) => r.course?.planId === id,
    )!;
    expect(course.course?.packagePrice).toBe(7500);
    expect(course.totalSittings).toBe(p.sessions);
    expect(course.course?.packageTemplateId).toBe(offer.id);
    expect(
      invoiceTotals(
        s.records["Packages & Billing"].find(
          (i) => i.id === course.course?.invoiceId,
        )!.invoice!,
      ).total,
    ).toBe(7500);
    expect(convertPlan(s, id, offer.id)).toBe(s);
    const updated = savePackage(s, {
      ...offer,
      packageConfig: { ...offer.packageConfig!, price: 9999, discount: 0 },
    });
    expect(
      updated.records["Treatment Plans"].find((r) => r.id === course.id)!.course
        ?.packagePrice,
    ).toBe(7500);
  });
  it("keeps financial/session ledgers separate: payment does not consume a sitting and completion does not charge again", () => {
    let s = reviewReady();
    const r = sessionRecord(s);
    const invoiceId = s.records["Packages & Billing"].find(
      (i) => i.status === "Pending",
    )!.id;
    s = recordFinancePayment(
      s,
      {
        id: "course-receipt",
        patientId: "MM-1042",
        invoiceId,
        amount: 24000,
        date: DEMO_DATE,
        method: "Cash",
        reference: "",
        note: "Fictional settlement",
      },
      true,
    );
    expect(sessionRecord(s).completedSittings).toBe(r.completedSittings);
    const receipts = structuredClone(s.records.Payments),
      invoices = structuredClone(s.records["Packages & Billing"]);
    s = completeSession(s, r.id, clinician, "Reviewed");
    expect(s.records.Payments).toEqual(receipts);
    expect(
      s.records["Packages & Billing"].map((i) => ({
        invoice: i.invoice,
        amount: i.amount,
        status: i.status,
      })),
    ).toEqual(
      invoices.map((i) => ({
        invoice: i.invoice,
        amount: i.amount,
        status: i.status,
      })),
    );
    expect(
      s.records["Packages & Billing"].find((i) => i.courseId === r.courseId)!
        .packageSessions?.remaining,
    ).toBe(1);
    expect(completeSession(s, r.id, clinician, "Retry")).toBe(s);
    expect(
      s.records["Packages & Billing"].find((i) => i.id === invoiceId)
        ?.packageSessions,
    ).toBeDefined();
  });
  it("calculates active, expiring, expired and exhausted purchases without editing course progress", () => {
    const c = resetState().records["Treatment Plans"][0];
    expect(
      packageState({
        ...c,
        totalSittings: 6,
        completedSittings: 4,
        course: { ...c.course!, validUntil: "2026-12-01" },
      }),
    ).toBe("Active");
    expect(
      packageState({
        ...c,
        course: { ...c.course!, validUntil: "2026-10-28" },
      }),
    ).toBe("Expiring");
    expect(
      packageState({
        ...c,
        course: { ...c.course!, validUntil: "2026-10-20" },
      }),
    ).toBe("Expired");
    expect(packageState({ ...c, totalSittings: 6, completedSittings: 6 })).toBe(
      "Exhausted",
    );
  });
});
