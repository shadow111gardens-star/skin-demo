import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Modal } from "../../components";
import { useClinic } from "../../store";
import { DEMO_DATE } from "../../data";
import { addDays } from "../../services";
import { inr } from "../finance/ledger";
import { TrendChart, BreakdownChart, type TrendPoint } from "./ReportCharts";
import {
  analyticsTabs,
  buildReport,
  validRange,
  previousRange,
  type AnalyticsTab,
  type ReportMetric,
  type ReportRow,
} from "./selectors";
import { downloadCSV } from "./csv";
import { visibleReportCSV, sourceRowsCSV } from "./reportExport";
const format = (value: number, unit: ReportMetric["unit"]) =>
  unit === "INR"
    ? inr(value)
    : value.toLocaleString("en-IN", { maximumFractionDigits: 2 }) +
      (unit === "%"
        ? "%"
        : unit === "minutes"
          ? " min"
          : unit === "hours"
            ? " h"
            : "");
function RecordRows({
  rows,
  unit = "count",
}: {
  rows: ReportRow[];
  unit?: ReportMetric["unit"];
}) {
  return (
    <>
      {rows.map((r, i) => (
        <Link className="analytics-record-row" key={r.id + "-" + i} to={r.href}>
          <div>
            <strong>{r.label}</strong>
            <small>
              {r.id} · {r.date || "Date not recorded"}
            </small>
            <small>{r.detail}</small>
          </div>
          <strong className="finance-number">
            {typeof r.value === "number"
              ? format(r.value, r.unit || unit)
              : r.value}
          </strong>
          <span className="analytics-open-label">Open record ↗</span>
        </Link>
      ))}
      {!rows.length && (
        <div className="analytics-empty">
          No qualifying source records in this range.
        </div>
      )}
    </>
  );
}
export default function Reports() {
  const { state, setState, notify } = useClinic(),
    [params, setParams] = useSearchParams(),
    [from, setFrom] = useState(params.get("from") || addDays(DEMO_DATE, -6)),
    [to, setTo] = useState(params.get("to") || params.get("date") || DEMO_DATE),
    [tab, setTab] = useState<AnalyticsTab>(
      analyticsTabs.includes(params.get("tab") as AnalyticsTab)
        ? (params.get("tab") as AnalyticsTab)
        : "Clinical Operations",
    ),
    [compare, setCompare] = useState(true),
    [selectedKey, setSelectedKey] = useState(""),
    [limit, setLimit] = useState(10),
    [inspector, setInspector] = useState<{
      title: string;
      definition: string;
      rows: ReportRow[];
      unit?: ReportMetric["unit"];
      from: string;
      to: string;
    }>(),
    [roomMinutes, setRoomMinutes] = useState(
      String(state.analyticsConfiguration?.roomPlanningMinutes || 480),
    ),
    [exportError, setExportError] = useState("");
  const valid = validRange(from, to),
    report = useMemo(
      () => (valid ? buildReport(state, from, to) : undefined),
      [state, from, to, valid],
    ),
    previous = useMemo(() => {
      if (!report || !compare) return;
      const r = previousRange(from, to);
      return validRange(r.from, r.to)
        ? buildReport(state, r.from, r.to)
        : undefined;
    }, [state, from, to, compare, report]);
  const metrics = report?.metrics[tab] || [],
    selected = metrics.find((m) => m.key === selectedKey) || metrics[0];
  const updateDates = (start: string, end: string) => {
    setFrom(start);
    setTo(end);
    setLimit(10);
    setInspector(undefined);
    setParams({ from: start, to: end, tab }, { replace: true });
  };
  const inspect = (
    title: string,
    definition: string,
    rows: ReportRow[],
    unit?: ReportMetric["unit"],
    period = { from, to },
  ) => setInspector({ title, definition, rows, unit, ...period });
  function inspectTrend(key: string, start?: string, end?: string) {
    if (!report) return;
    const isPrior = key === "previousCompleted",
      r = isPrior ? previous : report;
    if (!r) return;
    const metricKey =
      key === "previousCompleted"
        ? "completed"
        : key === "visits" || key === "repeatVisits"
          ? "repeat"
          : key;
    const m =
      r.metrics[tab].find((m) => m.key === metricKey) ||
      r.metrics["Clinical Operations"].find((m) => m.key === metricKey);
    let rows =
      key === "repeatVisits"
        ? r.repeatVisitRows
        : key === "visits"
          ? r.visitRows
          : m?.rows || [];
    if (start && end)
      rows = rows.filter((row) => row.date >= start && row.date <= end);
    inspect(
      (m?.label || "Completed visits") + (isPrior ? " · previous period" : ""),
      key === "visits" || key === "repeatVisits"
        ? "Distinct completed visits; return visits are second or later completed visits within this period. Appointment-linked sessions count once."
        : m?.definition ||
            "Distinct completed appointment/session visits, deduplicated by appointment.",
      rows,
      key === "visits" || key === "repeatVisits" ? "count" : m?.unit,
      { from: start || r.from, to: end || r.to },
    );
  }
  const trend: TrendPoint[] =
    report?.series.map((p, i) => ({
      ...p,
      previousCompleted: previous?.series[i]?.completed || 0,
    })) || [];
  const exportVisible = () => {
    if (!report || !selected) return;
    try {
      downloadCSV(
        "mmverse-" +
          tab.toLowerCase().replaceAll(" ", "-") +
          "-" +
          from +
          "-" +
          to +
          ".csv",
        visibleReportCSV(report, tab, selected, limit, previous),
      );
      setExportError("");
      notify("Visible report data downloaded as CSV");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Export unavailable";
      setExportError(message);
      notify(message, "error");
    }
  };
  return (
    <div className="analytics-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CONNECTED CLINIC INSIGHTS</span>
          <h1>Reports & Analytics</h1>
          <p>Clear measures, traceable records and honest comparisons.</p>
        </div>
        <button
          className="button primary"
          disabled={!report}
          onClick={exportVisible}
        >
          Export visible CSV
        </button>
      </div>
      <p className="analytics-notice">
        Fictional browser-local demo · no random chart values, connected device
        telemetry or external analytics service. Operating day: {DEMO_DATE}{" "}
        (IST).
      </p>
      <section className="card analytics-controls">
        <label>
          From date
          <input
            aria-label="Report from date"
            type="date"
            value={from}
            onChange={(e) => updateDates(e.target.value, to)}
          />
        </label>
        <label>
          To date
          <input
            aria-label="Report to date"
            type="date"
            value={to}
            onChange={(e) => updateDates(from, e.target.value)}
          />
        </label>
        <div className="analytics-date-presets">
          <button
            className="button"
            onClick={() => updateDates(DEMO_DATE, DEMO_DATE)}
          >
            Demo day
          </button>
          <button
            className="button"
            onClick={() => updateDates(addDays(DEMO_DATE, -6), DEMO_DATE)}
          >
            Last 7 days
          </button>
          <button
            className="button"
            onClick={() =>
              updateDates(DEMO_DATE.slice(0, 7) + "-01", DEMO_DATE)
            }
          >
            This demo month
          </button>
        </div>
        <label className="analytics-compare">
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => setCompare(e.target.checked)}
          />
          Compare previous equal period
        </label>
      </section>
      {!valid && (
        <p role="alert" className="form-error">
          Choose valid dates in order, covering no more than ten years.
        </p>
      )}
      {exportError && (
        <p role="alert" className="form-error">
          {exportError}
        </p>
      )}
      <nav className="analytics-tabs" aria-label="Analytics categories">
        {analyticsTabs.map((t) => (
          <button
            key={t}
            className={t === tab ? "active" : ""}
            aria-pressed={t === tab}
            onClick={() => {
              setTab(t);
              setSelectedKey("");
              setLimit(10);
              setParams({ from, to, tab: t }, { replace: true });
            }}
          >
            {t}
          </button>
        ))}
      </nav>
      {report && (
        <>
          <div className="analytics-period">
            <strong>
              {from} – {to} · {report.days} calendar day
              {report.days === 1 ? "" : "s"}
            </strong>
            {previous && (
              <span>
                Comparison: {previous.from} – {previous.to}
              </span>
            )}
          </div>
          <div className="analytics-kpis">
            {metrics.map((m) => {
              const prev = previous?.metrics[tab].find((p) => p.key === m.key);
              return (
                <button
                  className={
                    "card analytics-kpi " +
                    (selected?.key === m.key ? "selected" : "")
                  }
                  key={m.key}
                  aria-label={m.label + " " + format(m.value, m.unit)}
                  onClick={() => {
                    setSelectedKey(m.key);
                    setLimit(10);
                    inspect(m.label, m.definition, m.rows, m.unit);
                  }}
                >
                  <small>{m.label}</small>
                  <strong>{format(m.value, m.unit)}</strong>
                  {prev && (
                    <span>Previous: {format(prev.value, prev.unit)}</span>
                  )}
                  <span className="analytics-kpi-link">
                    View source records ↗
                  </span>
                </button>
              );
            })}
          </div>
          {tab === "Clinical Operations" && (
            <>
              <p className="analytics-caption">
                Session/appointment metrics use scheduled visit dates. Course
                completion uses courses started in this range. Follow-up metrics
                use recommended dates in the range, with overdue assessed at its
                end. Current record states are used; this is not a historical
                status-replay engine.
              </p>
              <div className="analytics-chart-grid">
                <TrendChart
                  title="Clinical activity over time"
                  description={
                    "Completed sitting records and appointment outcomes · counts · " +
                    from +
                    " to " +
                    to
                  }
                  data={trend}
                  series={[
                    { key: "completed", label: "Completed sessions" },
                    { key: "cancellations", label: "Cancellations" },
                    { key: "noShows", label: "No-shows" },
                    ...(previous
                      ? [
                          {
                            key: "previousCompleted",
                            label: "Previous completed sessions",
                          },
                        ]
                      : []),
                  ]}
                  onInspect={inspectTrend}
                />
                <BreakdownChart
                  title="Appointment outcome mix"
                  description="Selected scheduled dates · appointment counts; no session deductions inferred."
                  unit="count"
                  data={[
                    "Completed",
                    "Confirmed",
                    "Checked in",
                    "In progress",
                    "In preparation",
                    "Awaiting review",
                    "Cancelled",
                    "No-show",
                    "Waiting list",
                  ].map((name) => ({
                    name,
                    value: report.appointments.filter((a) => a.status === name)
                      .length,
                    rows: report.appointments
                      .filter((a) => a.status === name)
                      .map((a) => ({
                        id: a.id,
                        label:
                          state.patients.find((p) => p.id === a.patientId)
                            ?.name || a.patientId,
                        date: a.date,
                        detail: a.treatment + " · " + a.status,
                        value: 1,
                        href:
                          "/appointments?appointment=" +
                          a.id +
                          "&date=" +
                          a.date,
                      })),
                  }))}
                  onInspect={(d) =>
                    inspect(
                      d.name,
                      "Appointments scheduled in the selected date range with this current status.",
                      d.rows,
                    )
                  }
                />
              </div>
            </>
          )}
          {tab === "Financial Performance" && (
            <>
              <p className="analytics-caption">
                Invoice metrics use issue dates and exclude void/draft invoices.
                Collections use receipt/refund dates, including deposits.
                Outstanding is the issued-invoice cohort balance at period end.
                Treatment/package charges exclude tax. Draft projection is an
                estimate, never collected cash or issued revenue.
              </p>
              <div className="analytics-chart-grid">
                <TrendChart
                  title="Issued amounts vs recorded cash"
                  description="INR · receipts less refunds versus issued invoice totals; refunds shown separately."
                  data={trend}
                  currency
                  series={[
                    { key: "collections", label: "Net collections" },
                    { key: "invoiced", label: "Issued invoice totals" },
                    { key: "refunds", label: "Refunds" },
                  ]}
                  onInspect={inspectTrend}
                />
                <BreakdownChart
                  title="Treatment charges by source"
                  description="Issued consultation/procedure/package lines after discounts, before tax · INR."
                  data={report.treatmentRevenue}
                  unit="INR"
                  onInspect={(d) =>
                    inspect(
                      d.name,
                      "Source invoice lines; net of discounts and before tax. These are issued charges, not attributed cash receipts.",
                      d.rows,
                      "INR",
                    )
                  }
                />
              </div>
            </>
          )}
          {tab === "Resource Utilisation" && (
            <>
              <div className="card analytics-resource-config">
                <label>
                  Room planning minutes per day
                  <input
                    aria-label="Room planning minutes per day"
                    type="number"
                    min="1"
                    max="1440"
                    value={roomMinutes}
                    onChange={(e) => setRoomMinutes(e.target.value)}
                  />
                </label>
                <button
                  className="button"
                  onClick={() => {
                    const value = Number(roomMinutes);
                    if (!Number.isInteger(value) || value < 1 || value > 1440) {
                      notify(
                        "Enter planning capacity from 1–1440 minutes per room/day",
                        "error",
                      );
                      return;
                    }
                    setState((s) => ({
                      ...s,
                      analyticsConfiguration: { roomPlanningMinutes: value },
                    }));
                    notify(
                      "Room planning capacity saved; reports recalculated",
                    );
                  }}
                >
                  Save planning capacity
                </button>
                <small>
                  Clinic planning configuration, not measured occupancy or
                  hardware runtime.
                </small>
              </div>
              <p className="analytics-caption">
                All {report.days} calendar days count in the planning
                denominator. Eligible bookings exclude cancellations,
                reschedules, no-shows and waiting lists. Overlapping bookings
                can exceed capacity; percentages are not clamped.{" "}
                {report.unrecordedDurations} eligible bookings have no recorded
                duration; no minutes are invented.{" "}
                {report.openMaintenance.length} open maintenance windows await
                clearance and are excluded from recorded downtime hours.
              </p>
              <div className="analytics-chart-grid">
                <BreakdownChart
                  title="Machine planning utilisation"
                  description="Booked minutes / each machine's configured planning capacity · %."
                  unit="%"
                  data={report.machineResources.map((m) => ({
                    name: m.name,
                    value: m.utilisation,
                    rows: m.rows,
                  }))}
                  onInspect={(d) =>
                    inspect(
                      d.name,
                      "Eligible bookings used for this machine planning utilisation. Recorded duration values are minutes.",
                      d.rows,
                      "minutes",
                    )
                  }
                />
                <BreakdownChart
                  title="Room planning utilisation"
                  description="Exclusive room booking minutes / configured room capacity · %."
                  unit="%"
                  data={report.roomResources.map((r) => ({
                    name: r.name,
                    value: r.utilisation,
                    rows: r.rows,
                  }))}
                  onInspect={(d) =>
                    inspect(
                      d.name,
                      "Eligible room bookings; seating capacity does not create parallel appointment slots.",
                      d.rows,
                      "minutes",
                    )
                  }
                />
              </div>
              <section className="card analytics-workload">
                <h2>Technician workload</h2>
                {report.technicianResources.map((t) => (
                  <button
                    className="analytics-workload-row"
                    key={t.name}
                    onClick={() =>
                      inspect(
                        t.name,
                        "Eligible assigned appointment durations in this period.",
                        t.rows,
                        "minutes",
                      )
                    }
                  >
                    <strong>{t.name}</strong>
                    <span>{t.bookings} bookings</span>
                    <strong>{t.minutes} recorded min</strong>
                    <span>View bookings ↗</span>
                  </button>
                ))}
                {!report.technicianResources.length && (
                  <div className="analytics-empty">
                    No technician assignments in this range.
                  </div>
                )}
              </section>
            </>
          )}
          {tab === "Patient Retention" && (
            <>
              <p className="analytics-caption">
                Repeat visitors require two completed visits within this range;
                appointment-linked sessions count once. Inactivity is a
                period-end snapshot using Follow-up Centre rules. Renewals are
                an explicit repeat-purchase proxy. Follow-up conversion uses
                recommended-date cohorts and current linked bookings; enquiry
                conversion uses enquiry creation cohorts.
              </p>
              <div className="analytics-chart-grid">
                <TrendChart
                  title="Completed visits & return visits"
                  description="Distinct visit records · return visits are the second or later completed visit within this period."
                  data={trend}
                  series={[
                    { key: "visits", label: "Completed visits" },
                    { key: "repeatVisits", label: "Return visits" },
                  ]}
                  onInspect={inspectTrend}
                />
                <BreakdownChart
                  title="Enquiry cohort by current stage"
                  description="Enquiries created in the selected period · staff-entered stages, not clinical or financial proof."
                  data={report.leadStages}
                  unit="count"
                  onInspect={(d) =>
                    inspect(
                      d.name,
                      "Current CRM stages for enquiries created in this date range. Estimated values below are not billed or collected.",
                      d.rows,
                      "INR",
                    )
                  }
                />
              </div>
            </>
          )}
          {selected && (
            <section className="card analytics-records">
              <header>
                <div>
                  <span className="eyebrow">TRACEABLE SOURCE DATA</span>
                  <h2>{selected.label}</h2>
                  <p>{selected.definition}</p>
                </div>
                <span>
                  {selected.rows.length} source record
                  {selected.rows.length === 1 ? "" : "s"}
                </span>
              </header>
              <RecordRows
                rows={selected.rows.slice(0, limit)}
                unit={selected.unit}
              />
              {selected.rows.length > limit && (
                <button
                  className="button analytics-show-more"
                  onClick={() => setLimit(limit + 10)}
                >
                  Show 10 more source records
                </button>
              )}
            </section>
          )}
        </>
      )}
      {inspector && (
        <Modal
          title={inspector.title + " · Source records"}
          className="operations-modal analytics-inspector"
          onClose={() => setInspector(undefined)}
        >
          <p>{inspector.definition}</p>
          <p className="analytics-caption">
            {from} – {to}. Open a record to review its operational source.
          </p>
          <button
            className="button"
            onClick={() => {
              try {
                downloadCSV(
                  "mmverse-source-records.csv",
                  sourceRowsCSV(inspector.rows),
                );
                notify("Source records downloaded");
              } catch (e) {
                notify(
                  e instanceof Error ? e.message : "Export failed",
                  "error",
                );
              }
            }}
          >
            Export these records CSV
          </button>
          <RecordRows rows={inspector.rows} unit={inspector.unit} />
        </Modal>
      )}
    </div>
  );
}
