import { beforeEach, describe, it, expect } from "vitest";
import {
  resetState,
  DEMO_DATE,
  type ClinicState,
  type RecordItem,
  type Appointment,
} from "../../data";
import {
  buildReport,
  completedVisits,
  validRange,
  previousRange,
} from "./selectors";
import { saveInvoice, recordFinancePayment } from "../finance/services";
import { financeSummary } from "../finance/ledger";
import { encodeCSV } from "./csv";
import { visibleReportCSV } from "./reportExport";
function empty(): ClinicState {
  const s = resetState();
  s.appointments = [];
  for (const key of [
    "Sittings & Sessions",
    "Treatment Plans",
    "Plan Proposals",
    "Follow-ups",
    "Packages & Billing",
    "Payments",
    "Leads & Enquiries",
    "Maintenance",
  ])
    s.records[key] = [];
  return s;
}
const metric = (
  s: ClinicState,
  key: string,
  from = DEMO_DATE,
  to = DEMO_DATE,
) =>
  Object.values(buildReport(s, from, to).metrics)
    .flat()
    .find((m) => m.key === key)!;
function appointment(
  id: string,
  patientId: string,
  time: string,
  status: string,
  duration = 30,
): Appointment {
  return {
    id,
    patientId,
    time,
    status,
    duration,
    date: DEMO_DATE,
    treatment: "Laser Hair Reduction",
    doctor: "Dr. Mehta",
    technician: "Neha Rao",
    room: "Room 01",
    machineId: "machines-equipment-1",
  };
}
beforeEach(() => localStorage.clear());
describe("record-driven analytics", () => {
  it("reconciles baseline financial figures exactly with Billing and common ledger", () => {
    const s = resetState(),
      report = buildReport(s, DEMO_DATE, DEMO_DATE);
    expect(report.finance).toEqual(financeSummary(s, DEMO_DATE, DEMO_DATE));
    expect(metric(s, "collections").value).toBe(42000);
    expect(metric(s, "invoiced").value).toBe(42000);
    expect(metric(s, "packageSales").value).toBe(42000);
    expect(metric(s, "outstanding").value).toBe(24000);
    expect(metric(s, "projection").value).toBe(1500);
    expect(metric(s, "refunds").value).toBe(0);
    expect(report.series.reduce((n, d) => n + d.collections, 0)).toBe(42000);
  });
  it("counts cancellations/no-shows and deduplicates session-linked completed visits", () => {
    const s = empty(),
      base = resetState().records["Sittings & Sessions"][0];
    s.appointments = [
      appointment("done-1", "MM-1041", "09:00", "Completed", 60),
      appointment("done-2", "MM-1041", "14:00", "Completed", 45),
      appointment("cancel", "MM-1042", "10:00", "Cancelled"),
      appointment("no-show", "MM-1043", "11:00", "No-show"),
      appointment("confirmed", "MM-1044", "16:00", "Confirmed"),
    ];
    s.records["Sittings & Sessions"] = ["done-1", "done-2"].map((id, i) => ({
      ...structuredClone(base),
      id: "session-" + id,
      appointmentId: id,
      patientId: "MM-1041",
      status: "Completed",
      date: DEMO_DATE,
      session: { ...base.session!, machineId: "machines-equipment-1" },
      detail: "Fictional documented sitting " + i,
    }));
    expect(metric(s, "completed").value).toBe(2);
    expect(metric(s, "cancellations").value).toBe(1);
    expect(metric(s, "noShows").value).toBe(25);
    expect(completedVisits(s)).toHaveLength(2);
    expect(metric(s, "repeat").value).toBe(1);
    expect(buildReport(s, DEMO_DATE, DEMO_DATE).series[0].repeatVisits).toBe(1);
  });
  it("uses eligible booking minutes and configured calendar-day capacity without pretending runtime", () => {
    const s = empty();
    s.appointments = [
      appointment("done", "MM-1041", "09:00", "Completed", 60),
      appointment("book", "MM-1042", "10:00", "Confirmed", 30),
      appointment("cancel", "MM-1043", "11:00", "Cancelled", 120),
      appointment("no-show", "MM-1044", "13:00", "No-show", 120),
    ];
    const report = buildReport(s, DEMO_DATE, DEMO_DATE);
    expect(metric(s, "machineBookings").value).toBe(2);
    expect(report.machineResources[0].minutes).toBe(90);
    expect(report.machineResources[0].utilisation).toBe(18.75);
    expect(metric(s, "machineUtilisation").value).toBe(3.75);
    expect(metric(s, "technicianMinutes").value).toBe(90);
    expect(metric(s, "roomUtilisation").value).toBe(4.69);
    s.analyticsConfiguration = { roomPlanningMinutes: 240 };
    expect(metric(s, "roomUtilisation").value).toBe(9.38);
  });
  it("clips only closed documented maintenance windows to IST boundaries and identifies open windows separately", () => {
    const s = empty(),
      task = resetState().records.Maintenance[0];
    s.records.Maintenance = [
      {
        ...task,
        id: "closed",
        status: "Completed",
        maintenance: {
          ...task.maintenance!,
          startedAt: "2026-10-22T23:00:00+05:30",
          clearedAt: "2026-10-24T01:00:00+05:30",
          serviceDate: DEMO_DATE,
        },
      },
      {
        ...task,
        id: "open",
        status: "In Progress",
        maintenance: {
          ...task.maintenance!,
          startedAt: "2026-10-22T09:00:00+05:30",
          clearedAt: undefined,
        },
      },
    ];
    const r = buildReport(s, DEMO_DATE, DEMO_DATE);
    expect(metric(s, "downtime").value).toBe(24);
    expect(r.openMaintenance).toHaveLength(1);
  });
  it("distinguishes collected cash, issued treatment charges, package sales, discounts and explicit refunds", () => {
    let s = empty();
    const r: RecordItem = {
      id: "invoice-test",
      name: "Test",
      patientId: "MM-1041",
      status: "Draft",
      amount: 0,
      detail: "Fictional test",
      invoice: {
        number: "",
        state: "Draft",
        issueDate: "2026-10-22",
        dueDate: "2026-10-30",
        lines: [
          {
            id: "package",
            kind: "Package",
            description: "Fictional package",
            quantity: 1,
            price: 1000,
            discount: 0,
            taxIds: ["tax"],
          },
          {
            id: "procedure",
            kind: "Procedure",
            description: "Fictional procedure",
            quantity: 1,
            price: 1000,
            discount: 0,
            taxIds: ["tax"],
          },
          {
            id: "product",
            kind: "Product",
            description: "Fictional product",
            quantity: 1,
            price: 500,
            discount: 0,
            taxIds: [],
          },
        ],
        discount: 250,
        taxes: [
          { id: "tax", name: "Clinic example only", rate: 10, active: true },
        ],
        notes: "Fictional clinic config",
        events: [],
      },
    };
    s = saveInvoice(s, r, true, true);
    s = recordFinancePayment(
      s,
      {
        id: "receipt",
        patientId: "MM-1041",
        invoiceId: r.id,
        amount: 1000,
        date: "2026-10-22",
        method: "Cash",
        reference: "",
        note: "Fictional",
      },
      true,
    );
    s = recordFinancePayment(
      s,
      {
        id: "refund",
        patientId: "MM-1041",
        invoiceId: r.id,
        refundOf: "receipt",
        amount: 200,
        date: DEMO_DATE,
        method: "Cash",
        reference: "",
        note: "Explicit fictional refund",
      },
      true,
    );
    expect(metric(s, "invoiced", "2026-10-22", DEMO_DATE).value).toBe(2430);
    expect(metric(s, "collections", "2026-10-22", DEMO_DATE).value).toBe(800);
    expect(metric(s, "treatmentRevenue", "2026-10-22", DEMO_DATE).value).toBe(
      1800,
    );
    expect(metric(s, "packageSales", "2026-10-22", DEMO_DATE).value).toBe(900);
    expect(metric(s, "discounts", "2026-10-22", DEMO_DATE).value).toBe(250);
    expect(metric(s, "outstanding", "2026-10-22", DEMO_DATE).value).toBe(1630);
    expect(metric(s, "refunds").value).toBe(200);
    expect(metric(s, "collections").value).toBe(-200);
    expect(metric(s, "outstanding").value).toBe(0);
    expect(metric(s, "outstanding", "2026-10-22", "2026-10-22").value).toBe(
      1430,
    );
  });
  it("uses explicit follow-up booking links and actual lead-to-patient links rather than stage guesses", () => {
    const s = empty();
    s.appointments = [
      appointment("followup-book", "MM-1041", "09:00", "Confirmed"),
    ];
    s.records["Follow-ups"] = [
      {
        id: "f1",
        patientId: "MM-1041",
        name: "Ananya",
        detail: "Review",
        status: "Scheduled",
        amount: 0,
        dueDate: DEMO_DATE,
        appointmentId: "followup-book",
        followup: {
          assignedTo: "Riya",
          outcome: "Booked",
          nextAction: "Attend",
          category: "Routine review",
          contacts: [],
          appointmentId: "followup-book",
        },
      },
      {
        id: "f2",
        patientId: "MM-1042",
        name: "Rohan",
        detail: "Review",
        status: "Declined",
        amount: 0,
        dueDate: DEMO_DATE,
      },
    ];
    const base = resetState().records["Leads & Enquiries"][0];
    s.records["Leads & Enquiries"] = [
      {
        ...base,
        id: "l1",
        patientId: "MM-1041",
        status: "Contacted",
        lead: { ...base.lead!, createdDate: DEMO_DATE, convertedAt: DEMO_DATE },
      },
      {
        ...base,
        id: "l2",
        patientId: undefined,
        status: "Won",
        lead: { ...base.lead!, createdDate: DEMO_DATE, convertedAt: undefined },
      },
    ];
    expect(metric(s, "followupConversion").value).toBe(50);
    expect(metric(s, "leadConversion").value).toBe(50);
    expect(
      buildReport(s, DEMO_DATE, DEMO_DATE).leadStages.find(
        (v) => v.name === "Won",
      )?.value,
    ).toBe(1);
  });
  it("treats inactivity as an eligible period-end operational snapshot and excludes future registrations", () => {
    const s = empty();
    s.patients = s.patients.slice(0, 2);
    s.patients[0].registeredAt = "2026-01-01";
    s.patients[1].registeredAt = "2026-12-01";
    expect(metric(s, "inactive").value).toBe(1);
    expect(metric(s, "inactive", "2025-01-01", "2025-01-07").value).toBe(0);
  });
  it("rejects invalid ranges, compares equal periods and produces honest zero event series", () => {
    expect(validRange("2026-02-31", DEMO_DATE)).toBe(false);
    expect(validRange("2026-10-24", DEMO_DATE)).toBe(false);
    expect(previousRange("2026-10-17", DEMO_DATE)).toEqual({
      from: "2026-10-10",
      to: "2026-10-16",
    });
    const r = buildReport(resetState(), "2025-01-01", "2025-01-07");
    expect(r.series).toHaveLength(7);
    expect(
      r.series.every(
        (p) => p.completed === 0 && p.collections === 0 && p.invoiced === 0,
      ),
    ).toBe(true);
    expect(r.metrics["Financial Performance"].every((m) => m.value === 0)).toBe(
      true,
    );
  });
  it("counts confirmed completed courses in their business-date start cohort", () => {
    const s = empty(),
      base = structuredClone(resetState().records["Treatment Plans"][0]);
    s.records["Treatment Plans"] = [
      {
        ...base,
        id: "finished",
        status: "Completed",
        date: DEMO_DATE,
        totalSittings: 6,
        completedSittings: 6,
        course: {
          ...base.course!,
          startDate: DEMO_DATE,
          lastCompletedDate: DEMO_DATE,
          completionConfirmed: true,
          completionConfirmedAt: "2026-10-24T06:00:00Z",
        },
      },
      {
        ...base,
        id: "active",
        status: "Active",
        date: DEMO_DATE,
        course: {
          ...base.course!,
          startDate: DEMO_DATE,
          completionConfirmed: false,
        },
      },
    ];
    expect(metric(s, "courseCompletion").value).toBe(50);
  });
  it("merges overlapping closed maintenance intervals for the same machine", () => {
    const s = empty(),
      base = resetState().records.Maintenance[0];
    s.records.Maintenance = [
      {
        ...base,
        id: "window-1",
        status: "Completed",
        maintenance: {
          ...base.maintenance!,
          startedAt: "2026-10-23T09:00:00+05:30",
          clearedAt: "2026-10-23T11:00:00+05:30",
        },
      },
      {
        ...base,
        id: "window-2",
        status: "Completed",
        maintenance: {
          ...base.maintenance!,
          startedAt: "2026-10-23T10:00:00+05:30",
          clearedAt: "2026-10-23T12:00:00+05:30",
        },
      },
    ];
    expect(metric(s, "downtime").value).toBe(3);
    expect(buildReport(s, DEMO_DATE, DEMO_DATE).closedDowntime).toHaveLength(1);
  });
  it("identifies a renewal proxy only from repeat issued package purchases after prior expiry", () => {
    const s = empty(),
      base = structuredClone(resetState().records["Treatment Plans"][0]);
    s.records["Treatment Plans"] = [
      {
        ...base,
        id: "prior",
        status: "Completed",
        course: {
          ...base.course!,
          startDate: "2026-09-01",
          validUntil: "2026-10-22",
          lastCompletedDate: "2026-10-20",
        },
      },
      {
        ...base,
        id: "renewal",
        status: "Active",
        course: {
          ...base.course!,
          startDate: DEMO_DATE,
          validUntil: "2027-04-01",
        },
      },
    ];
    s.records["Packages & Billing"] = ["prior", "renewal"].map((id) => ({
      id: "invoice-" + id,
      name: id,
      status: "Pending",
      amount: 1000,
      detail: "Fictional package purchase",
      patientId: base.patientId,
      courseId: id,
      date: DEMO_DATE,
      invoice: {
        number: id,
        state: "Issued",
        issueDate: DEMO_DATE,
        dueDate: DEMO_DATE,
        lines: [
          {
            id: "line-" + id,
            kind: "Package",
            description: "Fictional package",
            quantity: 1,
            price: 1000,
            discount: 0,
            taxIds: [],
          },
        ],
        discount: 0,
        taxes: [],
        notes: "",
        events: [],
      },
    }));
    expect(metric(s, "renewals").value).toBe(1);
    s.records["Packages & Billing"][1].invoice!.state = "Draft";
    expect(metric(s, "renewals").value).toBe(0);
  });
  it("exports visible metrics, chart buckets and source rows with CSV escaping and formula protection", () => {
    const r = buildReport(resetState(), DEMO_DATE, DEMO_DATE),
      m = r.metrics["Financial Performance"][0],
      rows = visibleReportCSV(r, "Financial Performance", m, 1);
    expect(
      rows.filter((row) => row[0] === "Visible source records"),
    ).toHaveLength(1);
    expect(
      rows.some((row) => row[1] === "collections" && row[5] === 42000),
    ).toBe(true);
    const csv = encodeCSV([
      ["Name", "Value"],
      ['=HYPERLINK("bad")', -200],
      ["A, B", "Line\nbreak"],
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('"-200"');
    expect(csv).toContain('"A, B"');
    expect(csv).toContain("Line\nbreak");
  });
});
