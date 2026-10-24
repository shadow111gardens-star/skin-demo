import { closedMaintenanceRows } from "./resourceData";
import { type ClinicState, type RecordItem, DEMO_DATE } from "../../data";
import { addDays, safeDate } from "../../services";
import {
  financeSummary,
  invoiceTotals,
  round,
  invoiceBalance,
} from "../finance/ledger";
import { activeBooking } from "../scheduling/availability";
import { followupRows } from "../scheduling/followupLogic";
import { leadStages } from "../crm/model";
export type AnalyticsTab =
  | "Clinical Operations"
  | "Financial Performance"
  | "Resource Utilisation"
  | "Patient Retention";
export const analyticsTabs: AnalyticsTab[] = [
  "Clinical Operations",
  "Financial Performance",
  "Resource Utilisation",
  "Patient Retention",
];
export interface ReportRow {
  id: string;
  label: string;
  date: string;
  detail: string;
  value: number | string;
  href: string;
  unit?: "count" | "INR" | "%" | "minutes" | "hours";
}
export interface ReportMetric {
  key: string;
  label: string;
  value: number;
  unit: "count" | "INR" | "%" | "minutes" | "hours";
  rows: ReportRow[];
  definition: string;
}
const inRange = (d: string | undefined, from: string, to: string) =>
  !!d && d >= from && d <= to;
export function validRange(from: string, to: string) {
  return (
    !!from &&
    !!to &&
    safeDate(from) === from &&
    safeDate(to) === to &&
    from <= to &&
    rangeDays(from, to) <= 3660
  );
}
export function rangeDays(from: string, to: string) {
  return (
    Math.floor(
      (new Date(to + "T12:00:00Z").getTime() -
        new Date(from + "T12:00:00Z").getTime()) /
        86400000,
    ) + 1
  );
}
export function previousRange(from: string, to: string) {
  const days = rangeDays(from, to);
  return { from: addDays(from, -days), to: addDays(from, -1) };
}
export function completedVisits(s: ClinicState) {
  const visits = s.appointments
    .filter((a) => a.status === "Completed")
    .map((a) => ({
      id: a.id,
      patientId: a.patientId,
      date: a.date,
      treatment: a.treatment,
      href: "/appointments?appointment=" + a.id + "&date=" + a.date,
    }));
  const ids = new Set(visits.map((v) => v.id));
  for (const r of s.records["Sittings & Sessions"])
    if (
      r.status === "Completed" &&
      r.date &&
      (!r.appointmentId || !ids.has(r.appointmentId))
    ) {
      visits.push({
        id: r.appointmentId || r.id,
        patientId: r.patientId || "",
        date: r.date,
        treatment:
          s.records["Treatment Plans"].find((c) => c.id === r.courseId)?.course
            ?.treatmentName || r.detail,
        href: "/sittings-sessions/" + r.id,
      });
      if (r.appointmentId) ids.add(r.appointmentId);
    }
  return visits.sort((a, b) => (a.date + a.id).localeCompare(b.date + b.id));
}
export function buildReport(s: ClinicState, from: string, to: string) {
  if (!validRange(from, to))
    throw new Error("Choose valid dates in order, up to ten years.");
  const patient = (id?: string) =>
    s.patients.find((p) => p.id === id)?.name || id || "Unlinked record";
  const appointmentRow = (a: (typeof s.appointments)[number]): ReportRow => ({
    id: a.id,
    label: patient(a.patientId),
    date: a.date,
    detail: `${a.time} · ${a.treatment} · ${a.status} · ${a.room || "No room"} · ${a.technician || "No technician"}`,
    value: a.duration || 0,
    unit: "minutes",
    href: "/appointments?appointment=" + a.id + "&date=" + a.date,
  });
  const sessionRow = (r: RecordItem): ReportRow => ({
    id: r.id,
    label: patient(r.patientId),
    date: r.date || "",
    detail:
      s.records["Treatment Plans"].find((c) => c.id === r.courseId)?.course
        ?.treatmentName || r.detail,
    value: 1,
    unit: "count",
    href: "/sittings-sessions/" + r.id,
  });
  const courseRow = (r: RecordItem): ReportRow => ({
    id: r.id,
    label: patient(r.patientId),
    date: r.course?.startDate || r.date || "",
    detail: `${r.course?.treatmentName} · ${r.completedSittings || 0}/${r.totalSittings || 0} completed · ${r.status}`,
    value: r.completedSittings || 0,
    unit: "count",
    href: "/treatment-plans/courses/" + r.id,
  });
  const followupRow = (r: RecordItem): ReportRow => ({
    id: r.id,
    label: patient(r.patientId),
    date: r.dueDate || "",
    detail: `${r.followupKind || r.detail} · ${r.status}`,
    value: 1,
    unit: "count",
    href: "/follow-ups?record=" + r.id + "&date=" + to,
  });
  const appointments = s.appointments.filter((a) => inRange(a.date, from, to)),
    sessions = s.records["Sittings & Sessions"].filter(
      (r) => inRange(r.date, from, to) && r.status === "Completed",
    ),
    cancelled = appointments.filter((a) => a.status === "Cancelled"),
    noShows = appointments.filter((a) => a.status === "No-show"),
    attendance = appointments.filter(
      (a) => !["Cancelled", "Waiting list", "Rescheduled"].includes(a.status),
    ),
    courses = s.records["Treatment Plans"].filter(
      (r) => r.course && inRange(r.course.startDate, from, to),
    ),
    completedCourses = courses.filter(
      (r) =>
        r.status === "Completed" &&
        r.course?.completionConfirmed &&
        (r.course.lastCompletedDate ||
          r.course.completionConfirmedAt?.slice(0, 10) ||
          r.date ||
          "") <= to,
    ),
    eligible = {
      ...s,
      patients: s.patients.filter(
        (p) => !p.registeredAt || p.registeredAt.slice(0, 10) <= to,
      ),
    },
    followups = followupRows(eligible, to).filter((r) =>
      inRange(r.dueDate, from, to),
    ),
    openFollowups = followups.filter(
      (r) => !["Completed", "Declined"].includes(r.status),
    ),
    overdue = openFollowups.filter((r) => (r.dueDate || to) < to),
    overdueIds = new Set(overdue.map((r) => r.patientId));
  const finance = financeSummary(s, from, to),
    issued = finance.invoices.filter((r) => r.invoice?.state === "Issued"),
    invoiceRow = (r: RecordItem): ReportRow => ({
      id: r.id,
      label: r.invoice?.number || r.name,
      date: r.invoice?.issueDate || r.date || "",
      detail: patient(r.patientId) + " · " + r.invoice?.state,
      value: invoiceTotals(r.invoice!).total,
      unit: "INR",
      href: "/invoices/" + r.id,
    }),
    paymentRow = (r: RecordItem): ReportRow => ({
      id: r.id,
      label: patient(r.patientId),
      date: r.date || "",
      detail: `${r.payment?.kind} · ${r.payment?.method} · ${r.payment?.reference || "No external reference"}`,
      value: r.payment?.kind === "Refund" ? -r.amount : r.amount,
      unit: "INR",
      href: "/payments?record=" + r.id,
    });
  const treatmentRevenue = new Map<
    string,
    { name: string; value: number; rows: ReportRow[] }
  >();
  let treatmentCharges = 0,
    discounts = 0;
  for (const r of issued) {
    const t = invoiceTotals(r.invoice!);
    discounts += t.lineDiscount + t.discount;
    for (const l of r.invoice!.lines) {
      if (!["Consultation", "Procedure", "Package"].includes(l.kind)) continue;
      const value = round(
        (l.quantity * l.price - l.discount) *
          (t.subtotal ? t.net / t.subtotal : 0),
      );
      treatmentCharges += value;
      const name =
        s.records["Treatment Plans"].find((c) => c.id === r.courseId)?.course
          ?.treatmentName || l.description;
      const bucket = treatmentRevenue.get(name) || { name, value: 0, rows: [] };
      bucket.value = round(bucket.value + value);
      bucket.rows.push({
        ...invoiceRow(r),
        id: r.id + "-" + l.id,
        detail: l.description + " · pre-tax net charge",
        value,
      });
      treatmentRevenue.set(name, bucket);
    }
  }
  const booked = appointments.filter(activeBooking),
    days = rangeDays(from, to),
    roomCapacity = s.analyticsConfiguration?.roomPlanningMinutes || 480;
  const machineResources = s.records["Machines & Equipment"].map((m) => {
    const bookings = booked.filter((a) => a.machineId === m.id),
      minutes = bookings.reduce((n, a) => n + (a.duration || 0), 0),
      capacity = (m.machine?.planningMinutes || 0) * days;
    return {
      id: m.id,
      name: m.name,
      bookings: bookings.length,
      minutes,
      capacity,
      utilisation: capacity ? round((minutes / capacity) * 100) : 0,
      rows: bookings.map(appointmentRow),
    };
  });
  const roomResources = s.records["Rooms & Resources"].map((r) => {
    const bookings = booked.filter((a) => a.room === r.room?.code),
      minutes = bookings.reduce((n, a) => n + (a.duration || 0), 0);
    return {
      id: r.id,
      name: r.room?.code || r.name,
      bookings: bookings.length,
      minutes,
      capacity: roomCapacity * days,
      utilisation: round((minutes / (roomCapacity * days)) * 100),
      rows: bookings.map(appointmentRow),
    };
  });
  const technicianResources = [
    ...new Set(
      booked
        .map((a) => a.technician)
        .filter((v): v is string => !!v && v !== "Not assigned"),
    ),
  ].map((name) => {
    const bookings = booked.filter((a) => a.technician === name);
    return {
      name,
      bookings: bookings.length,
      minutes: bookings.reduce((n, a) => n + (a.duration || 0), 0),
      rows: bookings.map(appointmentRow),
    };
  });
  const end = new Date(addDays(to, 1) + "T00:00:00+05:30").getTime(),
    closedDowntime = closedMaintenanceRows(s, from, to);
  const openMaintenance = s.records.Maintenance.filter(
    (r) =>
      r.maintenance?.startedAt &&
      !r.maintenance.clearedAt &&
      new Date(r.maintenance.startedAt).getTime() < end &&
      ["In Progress", "Awaiting Clearance"].includes(r.status),
  );
  const visits = completedVisits(s).filter((v) => inRange(v.date, from, to)),
    patientVisitCounts = new Map<string, number>();
  for (const v of visits)
    patientVisitCounts.set(
      v.patientId,
      (patientVisitCounts.get(v.patientId) || 0) + 1,
    );
  const repeatIds = new Set(
      [...patientVisitCounts].filter(([, n]) => n >= 2).map(([id]) => id),
    ),
    inactive = followupRows(eligible, to).filter(
      (r) =>
        (r.followupKind === "Inactive Patient" ||
          r.followup?.category === "Inactive Patient") &&
        !["Completed", "Declined"].includes(r.status),
    ),
    convertedFollowups = followups.filter((r) => {
      const a = s.appointments.find(
        (a) => a.id === (r.followup?.appointmentId || r.appointmentId),
      );
      return !!a && activeBooking(a) && a.status !== "No-show";
    });
  const purchased = s.records["Treatment Plans"].filter(
    (c) =>
      c.course &&
      s.records["Packages & Billing"].some(
        (i) =>
          i.courseId === c.id &&
          i.invoice?.state === "Issued" &&
          i.invoice.lines.some((l) => l.kind === "Package"),
      ),
  );
  const renewals = purchased.filter(
    (c) =>
      inRange(c.course?.startDate, from, to) &&
      purchased.some(
        (p) =>
          p.id !== c.id &&
          p.patientId === c.patientId &&
          p.course?.treatmentId === c.course?.treatmentId &&
          p.course?.area === c.course?.area &&
          p.course!.startDate < c.course!.startDate &&
          (p.course!.validUntil < c.course!.startDate ||
            (p.status === "Completed" &&
              (p.course?.lastCompletedDate || p.date || "") <=
                c.course!.startDate)),
      ),
  );
  const leads = s.records["Leads & Enquiries"].filter(
      (r) => r.lead && inRange(r.lead.createdDate, from, to),
    ),
    convertedLeads = leads.filter(
      (r) => r.patientId && r.lead?.convertedAt && r.lead.convertedAt <= to,
    ),
    leadRow = (r: RecordItem): ReportRow => ({
      id: r.id,
      label: r.name,
      date: r.lead?.createdDate || "",
      detail: `${r.status} · ${r.lead?.source} · ${r.patientId ? "Linked " + r.patientId : "Not converted"}`,
      value: r.amount,
      unit: "INR",
      href: "/leads-enquiries?lead=" + r.id,
    });
  const metric = (
    key: string,
    label: string,
    value: number,
    unit: ReportMetric["unit"],
    rows: ReportRow[],
    definition: string,
  ): ReportMetric => ({ key, label, value, unit, rows, definition });
  const metrics: Record<AnalyticsTab, ReportMetric[]> = {
    "Clinical Operations": [
      metric(
        "completed",
        "Sessions completed",
        sessions.length,
        "count",
        sessions.map(sessionRow),
        "Completed sitting records with session dates in the selected period. No appointment/session double counting.",
      ),
      metric(
        "cancellations",
        "Cancellations",
        cancelled.length,
        "count",
        cancelled.map(appointmentRow),
        "Cancelled appointments whose scheduled dates fall in this period; no sitting consumed.",
      ),
      metric(
        "noShows",
        "No-show rate",
        attendance.length
          ? round((noShows.length / attendance.length) * 100)
          : 0,
        "%",
        noShows.map(appointmentRow),
        `${noShows.length} no-shows / ${attendance.length} appointments, excluding cancelled, waiting-list and rescheduled records.`,
      ),
      metric(
        "courseCompletion",
        "Course completion",
        courses.length
          ? round((completedCourses.length / courses.length) * 100)
          : 0,
        "%",
        completedCourses.map(courseRow),
        `${completedCourses.length} confirmed completed courses / ${courses.length} courses started in this period. Current records; completion must be on/before period end.`,
      ),
      metric(
        "followups",
        "Open follow-ups due",
        openFollowups.length,
        "count",
        openFollowups.map(followupRow),
        "Open follow-ups with recommended dates within the selected period, using the same Follow-up Centre sources.",
      ),
      metric(
        "overdue",
        "Overdue patients",
        overdueIds.size,
        "count",
        overdue.map(followupRow),
        "Unique patients among open follow-ups due in this period and overdue at its end.",
      ),
    ],
    "Financial Performance": [
      metric(
        "collections",
        "Collections received (net)",
        finance.collections,
        "INR",
        finance.payments.map(paymentRow),
        "Receipts less explicit refunds dated in this period, including unallocated deposits. No payment gateway.",
      ),
      metric(
        "invoiced",
        "Invoiced revenue",
        finance.billed,
        "INR",
        issued.map(invoiceRow),
        "Issued, non-void invoice totals by issue date; not money collected.",
      ),
      metric(
        "treatmentRevenue",
        "Treatment charges issued",
        round(treatmentCharges),
        "INR",
        [...treatmentRevenue.values()].flatMap((b) => b.rows),
        "Consultation, procedure and package lines after discounts, before tax, by invoice issue date. Product/deposit lines excluded.",
      ),
      metric(
        "packageSales",
        "Package sales",
        finance.packageSales,
        "INR",
        issued
          .filter((i) => i.invoice!.lines.some((l) => l.kind === "Package"))
          .map((i) => ({
            ...invoiceRow(i),
            value: round(
              i
                .invoice!.lines.filter((l) => l.kind === "Package")
                .reduce(
                  (n, l) =>
                    n +
                    (l.quantity * l.price - l.discount) *
                      (invoiceTotals(i.invoice!).subtotal
                        ? invoiceTotals(i.invoice!).net /
                          invoiceTotals(i.invoice!).subtotal
                        : 0),
                  0,
                ),
            ),
          })),
        "Issued package line values after proportional invoice discount, before tax. Not collections.",
      ),
      metric(
        "outstanding",
        "Outstanding balances",
        finance.outstanding,
        "INR",
        issued
          .filter((i) => invoiceBalance(s, i, to) > 0)
          .map((i) => ({ ...invoiceRow(i), value: invoiceBalance(s, i, to) })),
        "Unpaid balances as of period end for invoices issued within this period; deposits are not silently allocated.",
      ),
      metric(
        "discounts",
        "Discounts granted",
        round(discounts),
        "INR",
        issued
          .filter((i) => {
            const t = invoiceTotals(i.invoice!);
            return t.discount + t.lineDiscount > 0;
          })
          .map((i) => ({
            ...invoiceRow(i),
            value: round(
              invoiceTotals(i.invoice!).lineDiscount +
                invoiceTotals(i.invoice!).discount,
            ),
          })),
        "Line plus invoice discounts on issued invoices in this period.",
      ),
      metric(
        "refunds",
        "Refunds recorded",
        finance.refunds,
        "INR",
        finance.payments
          .filter((p) => p.payment?.kind === "Refund")
          .map((p) => ({ ...paymentRow(p), value: p.amount })),
        "Explicit refund entries by refund date, retained alongside original receipts.",
      ),
      metric(
        "projection",
        "Draft projection (unbilled)",
        finance.projected,
        "INR",
        finance.invoices
          .filter((i) => i.invoice?.state === "Draft")
          .map(invoiceRow),
        "Draft invoice estimates only. Not issued revenue, package sales or actual money collected.",
      ),
    ],
    "Resource Utilisation": [
      metric(
        "machineBookings",
        "Machine bookings",
        machineResources.reduce((n, m) => n + m.bookings, 0),
        "count",
        booked
          .filter((a) => machineResources.some((m) => m.id === a.machineId))
          .map(appointmentRow),
        "Eligible scheduled/active/completed bookings in this period. Cancellations, reschedules, no-shows and waiting list excluded.",
      ),
      metric(
        "machineUtilisation",
        "Machine planning utilisation",
        machineResources.reduce((n, m) => n + m.capacity, 0)
          ? round(
              (machineResources.reduce((n, m) => n + m.minutes, 0) /
                machineResources.reduce((n, m) => n + m.capacity, 0)) *
                100,
            )
          : 0,
        "%",
        booked
          .filter((a) => machineResources.some((m) => m.id === a.machineId))
          .map(appointmentRow),
        "Booked minutes / sum of machine-configured planning minutes across all selected calendar days. Not runtime or telemetry.",
      ),
      metric(
        "technicianMinutes",
        "Technician workload",
        technicianResources.reduce((n, t) => n + t.minutes, 0),
        "minutes",
        booked
          .filter((a) => a.technician && a.technician !== "Not assigned")
          .map(appointmentRow),
        "Recorded appointment duration assigned to technicians. Unknown durations contribute no invented minutes.",
      ),
      metric(
        "roomUtilisation",
        "Room planning utilisation",
        roomResources.length
          ? round(
              (roomResources.reduce((n, r) => n + r.minutes, 0) /
                (roomResources.length * roomCapacity * days)) *
                100,
            )
          : 0,
        "%",
        booked
          .filter((a) => roomResources.some((r) => r.name === a.room))
          .map(appointmentRow),
        `Booked minutes / ${roomCapacity} configured planning minutes per room per calendar day. Rooms remain exclusive resources; seating capacity is not parallel booking capacity.`,
      ),
      metric(
        "downtime",
        "Recorded maintenance downtime",
        round(closedDowntime.reduce((n, r) => n + Number(r.value), 0)),
        "hours",
        closedDowntime,
        "Closed documented maintenance windows clipped to this period in IST, merging overlaps on the same asset. Open windows are excluded from hours; no measured device downtime is implied.",
      ),
    ],
    "Patient Retention": [
      metric(
        "repeat",
        "Repeat visitors",
        repeatIds.size,
        "count",
        visits
          .filter((v) => repeatIds.has(v.patientId))
          .map((v) => ({
            id: v.id,
            label: patient(v.patientId),
            date: v.date,
            detail: v.treatment,
            value: 1,
            href: v.href,
          })),
        "Patients with at least two distinct completed visits within this period. Appointment-linked sessions are deduplicated.",
      ),
      metric(
        "retainedCourses",
        "Course completion",
        courses.length
          ? round((completedCourses.length / courses.length) * 100)
          : 0,
        "%",
        completedCourses.map(courseRow),
        `${completedCourses.length} confirmed completions / ${courses.length} courses started in this period.`,
      ),
      metric(
        "inactive",
        "Inactive patients at end",
        new Set(inactive.map((r) => r.patientId)).size,
        "count",
        inactive.map(followupRow),
        "Period-end snapshot using the Follow-up Centre inactivity rules (90 days without an eligible appointment, or explicit inactive status). Patients registered after period end are excluded.",
      ),
      metric(
        "renewals",
        "Package renewals (proxy)",
        renewals.length,
        "count",
        renewals.map(courseRow),
        "Repeat issued course purchases for the same patient, treatment and area after prior completion or expiry. No dedicated renewal flag exists; this is an explicit proxy.",
      ),
      metric(
        "followupConversion",
        "Follow-up booking conversion",
        followups.length
          ? round((convertedFollowups.length / followups.length) * 100)
          : 0,
        "%",
        convertedFollowups.map(followupRow),
        `${convertedFollowups.length} follow-ups with linked eligible appointments / ${followups.length} follow-ups due in this period. Current booking links; no inferred messaging attribution.`,
      ),
      metric(
        "leadConversion",
        "Enquiry-to-patient conversion",
        leads.length ? round((convertedLeads.length / leads.length) * 100) : 0,
        "%",
        convertedLeads.map(leadRow),
        `${convertedLeads.length} linked patients / ${leads.length} enquiries created in this period; conversion date on/before period end.`,
      ),
    ],
  };
  const step = Math.max(1, Math.ceil(days / 45)),
    series = [];
  const seen = new Set<string>();
  const repeatVisitIds = new Set<string>();
  for (const v of visits) {
    if (seen.has(v.patientId)) repeatVisitIds.add(v.id);
    seen.add(v.patientId);
  }
  for (let offset = 0; offset < days; offset += step) {
    const start = addDays(from, offset),
      finish = addDays(from, Math.min(days - 1, offset + step - 1)),
      f = financeSummary(s, start, finish);
    series.push({
      date: start,
      end: finish,
      completed: sessions.filter((r) => inRange(r.date, start, finish)).length,
      cancellations: cancelled.filter((a) => inRange(a.date, start, finish))
        .length,
      noShows: noShows.filter((a) => inRange(a.date, start, finish)).length,
      collections: f.collections,
      invoiced: f.billed,
      refunds: f.refunds,
      visits: visits.filter((v) => inRange(v.date, start, finish)).length,
      repeatVisits: visits.filter(
        (v) => repeatVisitIds.has(v.id) && inRange(v.date, start, finish),
      ).length,
    });
  }
  return {
    from,
    to,
    days,
    metrics,
    series,
    appointments,
    sessions,
    followups,
    finance,
    machineResources,
    roomResources,
    technicianResources,
    closedDowntime,
    openMaintenance,
    treatmentRevenue: [...treatmentRevenue.values()],
    leads,
    leadRows: leads.map(leadRow),
    leadStages: leadStages.map((name) => ({
      name,
      value: leads.filter((r) => r.status === name).length,
      rows: leads.filter((r) => r.status === name).map(leadRow),
    })),
    repeatVisitRows: visits
      .filter((v) => repeatVisitIds.has(v.id))
      .map((v) => ({
        id: v.id,
        label: patient(v.patientId),
        date: v.date,
        detail: v.treatment,
        value: 1,
        href: v.href,
      })),
    visitRows: visits.map((v) => ({
      id: v.id,
      label: patient(v.patientId),
      date: v.date,
      detail: v.treatment,
      value: 1,
      href: v.href,
    })),
    unrecordedDurations: booked.filter((a) => !a.duration).length,
    operatingDay: DEMO_DATE,
  };
}
