import {
  type AnalyticsTab,
  type ReportRow,
  type ReportMetric,
  buildReport,
} from "./selectors";
import type { CSVValue } from "./csv";
export type ReportResult = ReturnType<typeof buildReport>;
export const seriesKeys: Record<
  AnalyticsTab,
  Exclude<keyof ReportResult["series"][number], "date" | "end">[]
> = {
  "Clinical Operations": ["completed", "cancellations", "noShows"],
  "Financial Performance": ["collections", "invoiced", "refunds"],
  "Resource Utilisation": [],
  "Patient Retention": ["visits", "repeatVisits"],
};
export function visibleReportCSV(
  report: ReportResult,
  tab: AnalyticsTab,
  source: ReportMetric,
  limit: number,
  previous?: ReportResult,
): CSVValue[][] {
  const rows: CSVValue[][] = [
    [
      "section",
      "key",
      "from",
      "to",
      "label",
      "value",
      "unit",
      "record_id",
      "details",
    ],
  ];
  for (const r of [report, ...(previous ? [previous] : [])]) {
    const section = r === report ? "Current" : "Previous";
    for (const m of r.metrics[tab])
      rows.push([
        section + " KPI",
        m.key,
        r.from,
        r.to,
        m.label,
        m.value,
        m.unit,
        "",
        m.definition,
      ]);
    for (const point of r.series)
      for (const key of r === report
        ? seriesKeys[tab]
        : tab === "Clinical Operations"
          ? ["completed" as const]
          : [])
        rows.push([
          section + " chart",
          key,
          point.date,
          point.end,
          key,
          point[key],
          tab === "Financial Performance" ? "INR" : "count",
          "",
          "",
        ]);
  }
  if (tab === "Resource Utilisation") {
    for (const [type, resources] of [
      ["Machine", report.machineResources],
      ["Room", report.roomResources],
    ] as const)
      for (const resource of resources)
        for (const [key, value, unit] of [
          ["Bookings", resource.bookings, "count"],
          ["Booked minutes", resource.minutes, "minutes"],
          ["Planning utilisation", resource.utilisation, "%"],
        ] as const)
          rows.push([
            type + " resources",
            key,
            report.from,
            report.to,
            resource.name,
            value,
            unit,
            resource.id,
            "Planning capacity: " + resource.capacity + " minutes",
          ]);
    for (const t of report.technicianResources)
      rows.push([
        "Technician",
        "Workload",
        report.from,
        report.to,
        t.name,
        t.minutes,
        "minutes",
        "",
        t.bookings + " bookings",
      ]);
  }
  if (tab === "Financial Performance")
    for (const t of report.treatmentRevenue)
      rows.push([
        "Treatment charges",
        "Issued pre-tax net",
        report.from,
        report.to,
        t.name,
        t.value,
        "INR",
        "",
        "",
      ]);
  if (tab === "Patient Retention")
    for (const stage of report.leadStages)
      rows.push([
        "Enquiry cohort",
        "Stage count",
        report.from,
        report.to,
        stage.name,
        stage.value,
        "count",
        "",
        "Staff-entered stage; created-date cohort",
      ]);
  for (const row of source.rows.slice(0, limit))
    rows.push([
      "Visible source records",
      source.key,
      report.from,
      report.to,
      row.label,
      row.value,
      row.unit || source.unit,
      row.id,
      row.date + " · " + row.detail,
    ]);
  return rows;
}
export function sourceRowsCSV(rows: ReportRow[]): CSVValue[][] {
  return [
    ["record_id", "label", "date", "detail", "value", "unit", "route"],
    ...rows.map((r) => [
      r.id,
      r.label,
      r.date,
      r.detail,
      r.value,
      r.unit || "count",
      r.href,
    ]),
  ];
}
