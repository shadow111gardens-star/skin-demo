import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  ScanFace,
  ClipboardCheck,
  Files,
  ArrowUpRight,
  RotateCcw,
  CalendarDays,
} from "lucide-react";
import { useClinic } from "../../store";
import { Avatar, Badge } from "../../components";
import { dayLabel } from "../../services";
import { canCreateScan } from "./model";
import type { Role } from "../../auth";
import { ScanSafety } from "./ScanComponents";
export default function ScanLibrary({
  role,
  onCourse,
}: {
  role: Role;
  onCourse: (id: string) => void;
}) {
  const { state } = useClinic();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const status = params.get("status") || "All";
  const from = params.get("from") || params.get("date") || "";
  const to = params.get("to") || params.get("date") || "";
  const patientId = params.get("patientId") || "All";
  const rows = state.records["Skin Analysis"]
    .filter((r) => {
      const p = state.patients.find((p) => p.id === r.patientId);
      return (
        `${p?.name} ${r.patientId} ${r.id} ${r.scan?.brand} ${r.scan?.model}`
          .toLowerCase()
          .includes(q.toLowerCase()) &&
        (status === "All" ||
          r.status === status ||
          r.scan?.captureStatus === status) &&
        (!from || (r.date || "") >= from) &&
        (!to || (r.date || "") <= to) &&
        (patientId === "All" || r.patientId === patientId)
      );
    })
    .sort(
      (a, b) =>
        (b.date || "").localeCompare(a.date || "") || a.id.localeCompare(b.id),
    );
  const change = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.delete("date");
    next.set(key, value);
    setParams(next, { replace: true });
  };
  const counts = [
    {
      title: "All scan reports",
      value: state.records["Skin Analysis"].length,
      filter: "All",
      Icon: Files,
    },
    {
      title: "Awaiting review",
      value: state.records["Skin Analysis"].filter(
        (r) => r.status === "Awaiting Review",
      ).length,
      filter: "Awaiting Review",
      Icon: ScanFace,
    },
    {
      title: "Reviewed reports",
      value: state.records["Skin Analysis"].filter(
        (r) => r.status === "Reviewed",
      ).length,
      filter: "Reviewed",
      Icon: ClipboardCheck,
    },
    {
      title: "Draft captures",
      value: state.records["Skin Analysis"].filter((r) => r.status === "Draft")
        .length,
      filter: "Draft",
      Icon: CalendarDays,
    },
  ];
  return (
    <div className="skin-analysis-library">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CONNECTED CLINICAL DOCUMENTATION</div>
          <h1>Skin Analysis</h1>
          <p>A clearer view of each capture. A considered clinician review.</p>
        </div>
        <div className="heading-actions">
          <button
            className="button secondary"
            onClick={() => navigate("/skin-analysis/compare")}
          >
            <Files size={15} />
            Compare scans
          </button>
          {canCreateScan(role) && (
            <button
              className="button primary"
              onClick={() => navigate("/skin-analysis/new")}
            >
              <Plus size={16} />
              New scan
            </button>
          )}
        </div>
      </div>
      <div className="scan-library-stats">
        {counts.map((c) => (
          <button
            key={c.title}
            className={status === c.filter ? "active" : ""}
            onClick={() => change("status", c.filter)}
          >
            <span className="round-symbol sage-bg">
              <c.Icon size={18} />
            </span>
            <span>
              <small>{c.title}</small>
              <strong>{c.value}</strong>
            </span>
            <ArrowUpRight size={13} />
          </button>
        ))}
      </div>
      <ScanSafety />
      <section className="card scan-library-card">
        <div className="scan-library-search">
          <div className="search-field">
            <Search size={16} />
            <input
              aria-label="Search scan library"
              value={q}
              onChange={(e) => change("q", e.target.value)}
              placeholder="Search patient, scan ID or device…"
            />
          </div>
          <span>{rows.length} reports</span>
          <button className="button secondary" onClick={() => setParams({})}>
            <RotateCcw size={13} />
            Reset filters
          </button>
        </div>
        <div className="scan-library-filters">
          <label>
            Patient
            <select
              aria-label="Scan patient filter"
              value={patientId}
              onChange={(e) => change("patientId", e.target.value)}
            >
              <option value="All">All patients</option>
              {state.patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              aria-label="Scan status filter"
              value={status}
              onChange={(e) => change("status", e.target.value)}
            >
              {[
                "All",
                "Draft",
                "Imported Demo",
                "Files uploaded",
                "Awaiting Review",
                "Reviewed",
              ].map((s) => (
                <option value={s} key={s}>
                  {s === "All" ? "All statuses" : s}
                </option>
              ))}
            </select>
          </label>
          <label>
            From
            <input
              aria-label="Scan date from"
              type="date"
              value={from}
              onChange={(e) => change("from", e.target.value)}
            />
          </label>
          <label>
            To
            <input
              aria-label="Scan date to"
              type="date"
              value={to}
              min={from}
              onChange={(e) => change("to", e.target.value)}
            />
          </label>
        </div>
        {from && to && from > to ? (
          <div className="form-error" role="alert">
            The end date must be on or after the start date.
          </div>
        ) : (
          <div
            className="scan-library-table"
            role="table"
            aria-label="Scan library"
          >
            <div className="scan-library-head" role="row">
              {[
                "Patient / scan ID",
                "Scan date",
                "Device",
                "Scan status",
                "Report status",
                "Reviewing doctor",
                "Linked course",
                "",
              ].map((h, i) => (
                <span role="columnheader" key={h || i}>
                  {h || <span className="sr-only">Open report</span>}
                </span>
              ))}
            </div>
            {rows.map((r) => {
              const p = state.patients.find((p) => p.id === r.patientId);
              const course = state.records["Treatment Plans"].find(
                (c) => c.id === r.courseId,
              );
              return (
                <article className="scan-library-row" role="row" key={r.id}>
                  <div role="cell" className="scan-library-patient">
                    <button
                      className="patient-cell"
                      onClick={() => p && navigate("/patients/" + p.id)}
                    >
                      <Avatar name={p?.name || r.name} />
                      <span>
                        <strong>{p?.name || r.name}</strong>
                        <small>{r.patientId || "Patient not linked"}</small>
                      </span>
                    </button>
                    <button
                      className="scan-id-link"
                      onClick={() =>
                        navigate("/skin-analysis/" + encodeURIComponent(r.id))
                      }
                    >
                      {r.id}
                      <ArrowUpRight size={11} />
                    </button>
                  </div>
                  <div role="cell">
                    <small className="scan-cell-label">Scan date</small>
                    <strong>
                      {r.date ? dayLabel(r.date) : "Not recorded"}
                    </strong>
                    <small>{r.scan?.area || "Area not recorded"}</small>
                  </div>
                  <div role="cell">
                    <small className="scan-cell-label">Device</small>
                    <strong>{r.scan?.brand || "Not recorded"}</strong>
                    <small>{r.scan?.model || "Demo device"}</small>
                  </div>
                  <div role="cell">
                    <small className="scan-cell-label">Scan status</small>
                    <Badge>{r.scan?.captureStatus || "Draft"}</Badge>
                  </div>
                  <div role="cell">
                    <small className="scan-cell-label">Report status</small>
                    <Badge>{r.status}</Badge>
                  </div>
                  <div role="cell">
                    <small className="scan-cell-label">Reviewing doctor</small>
                    <strong>
                      {r.reviewedBy ||
                        r.doctor ||
                        p?.assignedDoctor ||
                        "Unassigned"}
                    </strong>
                    <small>
                      {r.status === "Reviewed"
                        ? "Review recorded"
                        : "Review pending"}
                    </small>
                  </div>
                  <div role="cell">
                    <small className="scan-cell-label">Linked course</small>
                    {course ? (
                      <button
                        className="scan-course-link"
                        onClick={() => onCourse(course.id)}
                      >
                        {course.detail.split(" · ")[0]}
                        <ArrowUpRight size={11} />
                      </button>
                    ) : (
                      <span className="scan-unlinked">Not linked</span>
                    )}
                  </div>
                  <div role="cell" className="scan-library-actions">
                    <button
                      className="icon"
                      aria-label={`Open report ${r.id}`}
                      onClick={() =>
                        navigate("/skin-analysis/" + encodeURIComponent(r.id))
                      }
                    >
                      <ArrowUpRight size={17} />
                    </button>
                    <button
                      className="button secondary scan-mobile-report"
                      onClick={() =>
                        navigate("/skin-analysis/" + encodeURIComponent(r.id))
                      }
                    >
                      Open report
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                </article>
              );
            })}
            {!rows.length && (
              <div className="empty">
                <ScanFace size={28} />
                <h3>No scans in this view</h3>
                <p>Try another patient, status or date range.</p>
                <button className="text-button" onClick={() => setParams({})}>
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}
        <div className="scan-library-foot">
          {rows.length} records · Scan dates shown in Asia/Kolkata · All
          measures are demonstration data
        </div>
      </section>
    </div>
  );
}
