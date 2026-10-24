import { useSearchParams } from "react-router-dom";
import {
  Search,
  Plus,
  ArrowUpRight,
  CalendarPlus,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Users,
  UserRoundCheck,
  Clock,
  UserRoundPlus,
} from "lucide-react";
import { useClinic } from "../store";
import { Avatar, Badge } from "../components";
import { money, type Patient } from "../data";
import { canBook, type Role } from "../auth";
import {
  filterPatients,
  patientSummary,
  effectivePatientStatus,
  patientStatuses,
  calculateAge,
  doctors,
  type PatientFilters,
} from "../patientServices";
import { dayLabel } from "../services";
export default function Patients({
  onPatient,
  onCreate,
  onBook,
  role,
}: {
  onPatient: (p: Patient) => void;
  onCreate: () => void;
  onBook: (p: Patient) => void;
  role: Role;
}) {
  const { state } = useClinic();
  const [params, setParams] = useSearchParams();
  const filters: PatientFilters = {
    q: params.get("q") || "",
    status: params.get("status") || "All",
    treatment: params.get("treatment") || "All",
    doctor: params.get("doctor") || "All",
    next: params.get("next") || "All",
    sort: params.get("sort") || "Name: A–Z",
  };
  const size = Number(params.get("size")) || 10;
  const pageSize = [10, 25, 50].includes(size) ? size : 10;
  const filtered = filterPatients(state, filters);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(pages, Math.max(1, Number(params.get("page")) || 1));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const change = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  };
  const shortDate = (value?: string) =>
    value ? dayLabel(value).replace(" 2026", "") : "—";
  return (
    <div className="patients-directory">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CONNECTED PATIENT CARE</div>
          <h1>Patients</h1>
          <p>One record. Every chapter of their care, connected.</p>
        </div>
        {canBook(role) && (
          <button className="button primary" onClick={onCreate}>
            <Plus size={16} />
            Register patient
          </button>
        )}
      </div>
      <div className="directory-metrics">
        {[
          {
            label: "All patients",
            value: state.patients.length,
            Icon: Users,
            status: "All",
          },
          {
            label: "In active care",
            value: state.patients.filter(
              (p) => effectivePatientStatus(state, p) === "Active",
            ).length,
            Icon: UserRoundCheck,
            status: "Active",
          },
          {
            label: "New patients",
            value: state.patients.filter(
              (p) => effectivePatientStatus(state, p) === "New",
            ).length,
            Icon: UserRoundPlus,
            status: "New",
          },
          {
            label: "Overdue for care",
            value: state.patients.filter(
              (p) => effectivePatientStatus(state, p) === "Overdue",
            ).length,
            Icon: Clock,
            status: "Overdue",
          },
        ].map((k) => (
          <button
            key={k.label}
            className={`directory-stat ${filters.status === k.status ? "selected" : ""}`}
            onClick={() => change("status", k.status)}
          >
            <span className="round-symbol sage-bg">
              <k.Icon size={18} />
            </span>
            <span>
              <small>{k.label}</small>
              <strong>{k.value}</strong>
            </span>
            <ArrowUpRight size={14} />
          </button>
        ))}
      </div>
      <section className="card directory-card">
        <div className="directory-search-line">
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Search patients"
              placeholder="Search by name, patient ID or mobile…"
              value={filters.q}
              onChange={(e) => change("q", e.target.value)}
            />
          </div>
          <span>{filtered.length} patients</span>
          <button className="button secondary" onClick={() => setParams({})}>
            <RotateCcw size={13} />
            Reset filters
          </button>
        </div>
        <div className="directory-filters">
          <label>
            Status
            <select
              aria-label="Patient status"
              value={filters.status}
              onChange={(e) => change("status", e.target.value)}
            >
              <option value="All">All statuses</option>
              {patientStatuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Treatment
            <select
              aria-label="Patient treatment"
              value={filters.treatment}
              onChange={(e) => change("treatment", e.target.value)}
            >
              <option value="All">All treatments</option>
              {[
                ...new Set([
                  ...state.patients.map((p) => p.treatment),
                  ...state.records["Treatment Catalogue"].map((r) => r.name),
                ]),
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Doctor
            <select
              aria-label="Assigned doctor filter"
              value={filters.doctor}
              onChange={(e) => change("doctor", e.target.value)}
            >
              <option value="All">All doctors</option>
              {[
                ...new Set([
                  ...doctors,
                  ...state.patients.map(
                    (p) => p.assignedDoctor || "Unassigned",
                  ),
                ]),
              ].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            Next visit
            <select
              aria-label="Next visit filter"
              value={filters.next}
              onChange={(e) => change("next", e.target.value)}
            >
              <option value="All">Any time</option>
              <option>Today</option>
              <option>Next 7 days</option>
              <option>No upcoming visit</option>
            </select>
          </label>
          <label className="directory-sort">
            Sort by
            <select
              aria-label="Sort patients"
              value={filters.sort}
              onChange={(e) => change("sort", e.target.value)}
            >
              {[
                "Name: A–Z",
                "Name: Z–A",
                "Next sitting",
                "Balance: high to low",
                "Recently registered",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <div
          className="directory-table"
          role="table"
          aria-label="Patient directory"
        >
          <div className="directory-table-head" role="row">
            <span role="columnheader">Patient</span>
            <span role="columnheader">Mobile</span>
            <span role="columnheader" className="directory-last">
              Last visit
            </span>
            <span role="columnheader">Next sitting</span>
            <span role="columnheader">Courses</span>
            <span role="columnheader" className="directory-doctor">
              Assigned doctor
            </span>
            <span role="columnheader">Outstanding</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">
              <span className="sr-only">Actions</span>
            </span>
          </div>
          {rows.map((p) => {
            const meta = patientSummary(state, p);
            return (
              <article className="directory-patient-row" role="row" key={p.id}>
                <div className="directory-identity" role="cell">
                  <button className="patient-cell" onClick={() => onPatient(p)}>
                    <Avatar name={p.name} />
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        {p.id} · {p.dob ? calculateAge(p.dob) : p.age} years
                      </small>
                      <small className="compact-doctor">{meta.doctor}</small>
                    </span>
                  </button>
                </div>
                <div role="cell" className="directory-phone">
                  <small className="cell-label">Mobile</small>
                  {p.phone}
                </div>
                <div role="cell" className="directory-last">
                  <small className="cell-label">Last visit</small>
                  {meta.lastDate
                    ? shortDate(meta.lastDate)
                    : p.lastVisit === "Not visited"
                      ? "First visit"
                      : p.lastVisit}
                </div>
                <div role="cell" className="directory-next">
                  <small className="cell-label">Next sitting</small>
                  <strong>
                    {meta.next
                      ? `${shortDate(meta.next.date)} · ${meta.next.time}`
                      : "Not scheduled"}
                  </strong>
                  <small>
                    {meta.next?.treatment || "Plan their next step"}
                  </small>
                </div>
                <div role="cell" className="directory-courses">
                  <small className="cell-label">Active courses</small>
                  <strong>{meta.active.length}</strong>
                  <small>
                    {meta.active.length
                      ? "in progress"
                      : meta.courses.length
                        ? "completed"
                        : "No course yet"}
                  </small>
                </div>
                <div role="cell" className="directory-doctor">
                  <small className="cell-label">Assigned doctor</small>
                  {meta.doctor}
                </div>
                <div
                  role="cell"
                  className={`directory-balance ${meta.outstanding ? "has-balance" : ""}`}
                >
                  <small className="cell-label">Outstanding</small>
                  <strong>{money(meta.outstanding)}</strong>
                  <small>
                    {meta.outstanding ? "Pending payment" : "No dues"}
                  </small>
                </div>
                <div role="cell" className="directory-status">
                  <Badge>{meta.status}</Badge>
                </div>
                <div role="cell" className="directory-row-actions">
                  <button
                    className="icon desktop-open"
                    aria-label={`Open ${p.name}`}
                    onClick={() => onPatient(p)}
                  >
                    <ArrowUpRight size={17} />
                  </button>
                  <button
                    className="button secondary mobile-patient-action"
                    onClick={() => onPatient(p)}
                  >
                    View profile
                    <ArrowUpRight size={13} />
                  </button>
                  {canBook(role) && p.status !== "Archived" && (
                    <button
                      className="button secondary mobile-patient-action"
                      aria-label={`Book appointment for ${p.name}`}
                      onClick={() => onBook(p)}
                    >
                      <CalendarPlus size={14} />
                      Book visit
                    </button>
                  )}
                </div>
              </article>
            );
          })}
          {!rows.length && (
            <div className="empty">
              <Users size={27} />
              <h3>No patients match these filters</h3>
              <p>Try another name, mobile number or care filter.</p>
              <button className="text-button" onClick={() => setParams({})}>
                Reset filters
              </button>
            </div>
          )}
        </div>
        <div className="directory-pagination">
          <span>
            {filtered.length
              ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)}`
              : "0"}{" "}
            of {filtered.length} patients
          </span>
          <label>
            Show
            <select
              aria-label="Patients per page"
              value={pageSize}
              onChange={(e) => change("size", e.target.value)}
            >
              {[10, 25, 50].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <div>
            <button
              className="icon"
              disabled={page === 1}
              aria-label="Previous patients page"
              onClick={() => change("page", String(page - 1))}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              Page {page} of {pages}
            </span>
            <button
              className="icon"
              disabled={page === pages}
              aria-label="Next patients page"
              onClick={() => change("page", String(page + 1))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
      <p className="directory-footnote">
        Next visits are relative to 23 Oct 2026 · All records are fictional ·
        Times in IST
      </p>
    </div>
  );
}
