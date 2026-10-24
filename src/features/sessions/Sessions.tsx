import { safeDate } from "../../services";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus,
  Search,
  ArrowUpRight,
  Settings2,
  Clock,
  Play,
  CheckCircle2,
} from "lucide-react";
import { useClinic } from "../../store";
import { Avatar, Badge } from "../../components";
import { DEMO_DATE, type ClinicState } from "../../data";
import { canClinical, type Role } from "../../auth";
import { normalizeStatus, sessionStatuses, clinicalActor } from "./model";
import { ensureSession } from "./sessionData";
import ConfigurationDialog from "./ConfigurationDialog";
export default function Sessions({
  role,
  onCreate,
}: {
  role: Role;
  onCreate: () => void;
}) {
  const { state, setState, notify } = useClinic();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const id = params.get("record");
    if (id)
      navigate("/sittings-sessions/" + encodeURIComponent(id), {
        replace: true,
      });
  }, [params, navigate]);
  const [configuration, setConfiguration] = useState(false);
  const view =
    params.get("view") ||
    ([
      "In progress",
      "Awaiting review",
      "Completed",
      "Cancelled",
      "No-show",
    ].includes(params.get("status") || "")
      ? normalizeStatus(params.get("status")!)
      : "Today");
  const date = safeDate(params.get("date"));
  const q = params.get("q") || "",
    status =
      !params.get("status") || params.get("status") === "All"
        ? "All"
        : normalizeStatus(params.get("status")!),
    treatment = params.get("treatment") || "All",
    machine = params.get("machine") || "All",
    operator = params.get("technician") || "All";
  const change = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
  };
  const rows = state.records["Sittings & Sessions"]
    .filter((r) => {
      const d = r.session;
      if (!d) return false;
      const a = state.appointments.find((a) => a.id === r.appointmentId);
      const period =
        view === "Today"
          ? r.date === date
          : view === "Upcoming"
            ? (r.date || "") > date &&
              !["Completed", "Cancelled", "No-show"].includes(r.status)
            : r.status === view && (!params.has("date") || r.date === date);
      return (
        period &&
        (status === "All" || normalizeStatus(status) === r.status) &&
        (treatment === "All" ||
          a?.treatment === treatment ||
          (treatment === "laser" &&
            a?.treatment.toLowerCase().includes("laser"))) &&
        (machine === "All" || d.machineId === machine) &&
        (operator === "All" || d.operator === operator) &&
        (
          r.name +
          " " +
          r.patientId +
          " " +
          r.id +
          " " +
          (a?.treatment || r.detail)
        )
          .toLowerCase()
          .includes(q.toLowerCase())
      );
    })
    .sort((a, b) =>
      (a.date + " " + a.session!.time).localeCompare(
        b.date + " " + b.session!.time,
      ),
    );
  function commit(s: ClinicState, message: string) {
    try {
      localStorage.setItem("mmverse-v1", JSON.stringify(s));
      setState(s);
      notify(message);
      return true;
    } catch {
      notify("Configuration could not be saved locally.", "error");
      return false;
    }
  }
  function open(id: string) {
    const r = state.records["Sittings & Sessions"].find((r) => r.id === id);
    if (!r) return;
    if (r.appointmentId) {
      const linked = ensureSession(state, r.appointmentId);
      if (linked.state !== state)
        commit(linked.state, "Session record prepared");
    }
    navigate("/sittings-sessions/" + id);
  }
  return (
    <div className="sessions-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CONNECTED CLINICAL OPERATIONS</div>
          <h1>Sittings & Sessions</h1>
          <p>
            Prepare carefully. Document clearly. Keep every sitting connected.
          </p>
        </div>
        <div className="heading-actions">
          {role === "Clinic Owner" && (
            <button
              className="button secondary"
              onClick={() => setConfiguration(true)}
            >
              <Settings2 size={14} />
              Clinic checks
            </button>
          )}
          {canClinical(role) && (
            <button className="button primary" onClick={onCreate}>
              <Plus size={15} />
              Open / prepare sitting
            </button>
          )}
        </div>
      </div>
      <div className="session-summary-chips">
        {[
          {
            label: "Today",
            n: state.records["Sittings & Sessions"].filter(
              (r) =>
                r.date === date && !["Cancelled", "No-show"].includes(r.status),
            ).length,
            Icon: Clock,
          },
          {
            label: "In progress",
            n: state.records["Sittings & Sessions"].filter(
              (r) => r.status === "In Progress",
            ).length,
            Icon: Play,
          },
          {
            label: "Awaiting clinician review",
            n: state.records["Sittings & Sessions"].filter(
              (r) => r.status === "Awaiting Review",
            ).length,
            Icon: CheckCircle2,
          },
        ].map((c) => (
          <div key={c.label}>
            <c.Icon size={14} />
            <strong>{c.n}</strong>
            <span>{c.label}</span>
          </div>
        ))}
      </div>
      <nav className="session-queue-tabs" aria-label="Session views">
        {[
          "Today",
          "Upcoming",
          "In Progress",
          "Awaiting Review",
          "Completed",
          "Cancelled",
          "No-show",
        ].map((v) => (
          <button
            key={v}
            aria-current={view === v ? "page" : undefined}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set("view", v);
              next.delete("status");
              setParams(next);
            }}
          >
            {v}
          </button>
        ))}
      </nav>
      <section className="card session-queue-card">
        <div className="session-search-row">
          <div className="search-field">
            <Search size={15} />
            <input
              aria-label="Search sessions"
              value={q}
              onChange={(e) => change("q", e.target.value)}
              placeholder="Patient, ID, treatment or session…"
            />
          </div>
          <span>{rows.length} sittings</span>
          <button className="text-button" onClick={() => setParams({})}>
            Reset filters
          </button>
        </div>
        <div className="session-filters">
          <label>
            Clinic day / date
            <input
              aria-label="Session date filter"
              type="date"
              value={date}
              onChange={(e) => change("date", e.target.value)}
            />
          </label>
          <label>
            Status
            <select
              aria-label="Session status filter"
              value={status}
              onChange={(e) => change("status", e.target.value)}
            >
              {["All", ...sessionStatuses].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Treatment
            <select
              aria-label="Session treatment filter"
              value={treatment}
              onChange={(e) => change("treatment", e.target.value)}
            >
              <option>All</option>
              <option value="laser">All laser treatments</option>
              {[...new Set(state.appointments.map((a) => a.treatment))].map(
                (t) => (
                  <option key={t}>{t}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Machine
            <select
              aria-label="Session machine filter"
              value={machine}
              onChange={(e) => change("machine", e.target.value)}
            >
              <option value="All">All machines</option>
              {state.records["Machines & Equipment"].map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Technician
            <select
              aria-label="Session technician filter"
              value={operator}
              onChange={(e) => change("technician", e.target.value)}
            >
              <option value="All">All technicians</option>
              {[
                ...new Set(
                  state.records["Sittings & Sessions"]
                    .map((r) => r.session?.operator)
                    .filter(Boolean),
                ),
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
        <div
          className="session-queue-table"
          role="table"
          aria-label="Session queue"
        >
          <div className="session-queue-head" role="row">
            {[
              "Time / patient",
              "Treatment & sitting",
              "Care team",
              "Machine / room",
              "Status",
              "",
            ].map((h, i) => (
              <span role="columnheader" key={i}>
                {h || "Open"}
              </span>
            ))}
          </div>
          {rows.map((r) => {
            const d = r.session!,
              a = state.appointments.find((a) => a.id === r.appointmentId);
            return (
              <article className="session-queue-row" role="row" key={r.id}>
                <div role="cell">
                  <small className="session-time">
                    {d.time} · {r.date}
                  </small>
                  <button
                    className="patient-cell"
                    onClick={() => navigate("/patients/" + r.patientId)}
                  >
                    <Avatar name={r.name} />
                    <span>
                      <strong>{r.name}</strong>
                      <small>{r.patientId}</small>
                    </span>
                  </button>
                </div>
                <div role="cell">
                  <strong>{a?.treatment || r.detail.split(" | ")[0]}</strong>
                  <small>
                    Sitting {d.number}
                    {a?.totalSittings ? " of " + a.totalSittings : ""}
                  </small>
                  {r.courseId ? (
                    <button
                      className="text-button"
                      onClick={() =>
                        navigate("/treatment-plans/courses/" + r.courseId)
                      }
                    >
                      View course ↗
                    </button>
                  ) : (
                    <small>Single visit</small>
                  )}
                </div>
                <div role="cell">
                  <strong>{d.reviewingDoctor || "Doctor unassigned"}</strong>
                  <small>Tech · {d.operator || "Not assigned"}</small>
                </div>
                <div role="cell">
                  <strong>
                    {state.records["Machines & Equipment"].find(
                      (m) => m.id === d.machineId,
                    )?.name || "No machine selected"}
                  </strong>
                  <small>{d.room || "Room not assigned"}</small>
                </div>
                <div role="cell">
                  <Badge>{r.status}</Badge>
                  {d.reaction === "Observed" && (
                    <small className="session-danger-text">
                      Reaction · clinician review
                    </small>
                  )}
                </div>
                <div role="cell">
                  <button
                    className="button secondary"
                    aria-label={"Open session " + r.id}
                    onClick={() => open(r.id)}
                  >
                    Open
                    <ArrowUpRight size={13} />
                  </button>
                </div>
              </article>
            );
          })}
          {!rows.length && (
            <div className="empty">
              <Clock size={25} />
              <h3>No sittings in this view</h3>
              <p>
                Try another date or filter. No sitting is consumed by
                cancellation or rescheduling.
              </p>
            </div>
          )}
        </div>
        <p className="session-table-foot">
          Fictional demo · clinic operating day {DEMO_DATE} · Asia/Kolkata ·
          parameters are documented, never prescribed
        </p>
      </section>
      {configuration && clinicalActor(role) && (
        <ConfigurationDialog
          role={role}
          onClose={() => setConfiguration(false)}
          onSave={commit}
        />
      )}
    </div>
  );
}
