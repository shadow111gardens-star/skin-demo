import { ensureSession } from "./sessions/sessionData";
import { transitionSession, rescheduleSession } from "./sessions/services";
import { useState, type FormEvent } from "react";
import {
  Search,
  ArrowUpRight,
  MoreHorizontal,
  Play,
  CalendarDays,
  Check,
  Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useClinic } from "../store";
import { Avatar, Badge, Modal, SectionTitle } from "../components";
import { type Appointment, type Patient, slug } from "../data";
import { canBook, canClinical, type Role } from "../auth";
import { dayLabel } from "../services";
interface Props {
  patientId?: string;
  excludeCancelled?: boolean;
  initialStatus?: string;
  initialTreatment?: string;
  date: string;
  role: Role;
  onPatient: (p: Patient) => void;
  onCourse: (id: string) => void;
}
export default function TreatmentQueue({
  date,
  patientId,
  excludeCancelled = false,
  role,
  onPatient,
  onCourse,
  initialStatus = "All",
  initialTreatment = "All",
}: Props) {
  const { state, setState, notify } = useClinic();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [treatment, setTreatment] = useState(initialTreatment);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const rows = state.appointments
    .filter(
      (a) =>
        a.date === date &&
        a.status !== "Waiting list" &&
        (!patientId || a.patientId === patientId) &&
        (!excludeCancelled ||
          status === "Cancelled" ||
          a.status !== "Cancelled") &&
        (status === "All" || a.status === status) &&
        (treatment === "All" ||
          (treatment === "laser"
            ? a.treatment.toLowerCase().includes("laser")
            : a.treatment === treatment)) &&
        `${state.patients.find((p) => p.id === a.patientId)?.name} ${a.patientId} ${a.treatment}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => a.time.localeCompare(b.time));
  function openWorkspace(a: Appointment) {
    const linked = ensureSession(state, a.id);
    setState(linked.state);
    setSelected(null);
    navigate("/sittings-sessions/" + linked.record.id);
  }
  function checkIn(a: Appointment) {
    try {
      const linked = ensureSession(state, a.id);
      setState(
        transitionSession(linked.state, linked.record.id, "Checked In", {
          role,
          name: role,
        }),
      );
      notify("Patient checked in");
      setSelected(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const f = new FormData(e.currentTarget);
    try {
      const linked = ensureSession(state, selected.id);
      const next =
        action === "cancel"
          ? transitionSession(
              linked.state,
              linked.record.id,
              "Cancelled",
              { role, name: role },
              "Cancellation confirmed from appointment queue",
            )
          : rescheduleSession(
              linked.state,
              linked.record.id,
              String(f.get("date")),
              String(f.get("time")),
              "Rescheduling confirmed from appointment queue",
              role,
            );
      setState(next);
      notify(
        action === "cancel"
          ? "Appointment cancelled; package unchanged"
          : "Appointment rescheduled; package unchanged",
      );
      setSelected(null);
      setAction("");
    } catch (err) {
      setError((err as Error).message);
    }
  }
  const open = (a: Appointment, next = "") => {
    setSelected(a);
    setAction(next);
    setError("");
  };
  return (
    <section className="card queue-card">
      <SectionTitle
        title="Today’s treatment queue"
        action="Full schedule"
        onClick={() => navigate(`/${slug("Appointments")}?date=${date}`)}
      />
      <div className="queue-subtitle">
        {dayLabel(date)} · All times in IST <span>{rows.length} visits</span>
      </div>
      <div className="queue-filters">
        <div className="search-field">
          <Search size={15} />
          <input
            aria-label="Search treatment queue"
            placeholder="Search patient, ID or treatment…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Queue status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {[
            "All",
            "Confirmed",
            "Checked in",
            "In progress",
            "Completed",
            "Cancelled",
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Queue treatment"
          value={treatment}
          onChange={(e) => setTreatment(e.target.value)}
        >
          <option value="All">All treatments</option>
          <option value="laser">All laser treatments</option>
          {[
            ...new Set(
              state.appointments
                .filter((a) => a.date === date)
                .map((a) => a.treatment),
            ),
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="queue-table">
        <div className="queue-head">
          <span>Time / patient</span>
          <span>Treatment / course</span>
          <span>Care team</span>
          <span>Room / machine</span>
          <span>Status</span>
          <span />
        </div>
        {rows.map((a) => {
          const p = state.patients.find((p) => p.id === a.patientId);
          if (!p) return null;
          const machine = state.records["Machines & Equipment"].find(
            (m) => m.id === a.machineId,
          );
          return (
            <article className="queue-row" key={a.id}>
              <div className="queue-person">
                <span className="queue-time">
                  {a.time}
                  <small>{a.duration || 45} min</small>
                </span>
                <button className="patient-cell" onClick={() => onPatient(p)}>
                  <Avatar name={p.name} />
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.id}</small>
                  </span>
                </button>
              </div>
              <div className="queue-treatment">
                <strong>{a.treatment}</strong>
                {a.courseId &&
                state.records["Treatment Plans"].some(
                  (r) => r.id === a.courseId,
                ) ? (
                  <button
                    className="text-button"
                    onClick={() => onCourse(a.courseId!)}
                  >
                    Sitting {a.sitting || 1} of {a.totalSittings || 6} · View
                    course <ArrowUpRight size={11} />
                  </button>
                ) : (
                  <small>
                    Sitting {a.sitting || 1} of {a.totalSittings || 1} · Single
                    visit
                  </small>
                )}
              </div>
              <div className="queue-team">
                <span>{a.doctor}</span>
                <small>Tech · {a.technician || "To be assigned"}</small>
              </div>
              <div className="queue-room">
                <span>{a.room || "To be assigned"}</span>
                <small>{machine?.name || "No machine required"}</small>
              </div>
              <div className="queue-status">
                <Badge>{a.status}</Badge>
              </div>
              <button
                className="icon queue-menu"
                aria-label={`Actions for ${p.name} at ${a.time}`}
                onClick={() => open(a)}
              >
                <MoreHorizontal size={18} />
              </button>
            </article>
          );
        })}
        {!rows.length && (
          <div className="empty">
            <CalendarDays size={25} />
            <h3>No visits match this view</h3>
            <p>Try another date or clear the queue filters.</p>
            <button
              className="text-button"
              onClick={() => {
                setSearch("");
                setStatus("All");
                setTreatment("All");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
      {selected && (
        <Modal
          title={
            action === "reschedule"
              ? "Reschedule appointment"
              : action === "cancel"
                ? "Cancel appointment"
                : "Appointment actions"
          }
          onClose={() => setSelected(null)}
        >
          <div className="action-summary">
            <strong>
              {state.patients.find((p) => p.id === selected.patientId)?.name}
            </strong>
            <p>
              {selected.treatment} · {selected.date} · {selected.time} IST
            </p>
            <Badge>{selected.status}</Badge>
          </div>
          {!action ? (
            <div className="action-list">
              <button
                onClick={() => {
                  onPatient(
                    state.patients.find((p) => p.id === selected.patientId)!,
                  );
                  setSelected(null);
                }}
              >
                <ArrowUpRight size={17} />
                Open patient profile
              </button>
              {selected.courseId &&
                state.records["Treatment Plans"].some(
                  (r) => r.id === selected.courseId,
                ) && (
                  <button
                    onClick={() => {
                      onCourse(selected.courseId!);
                      setSelected(null);
                    }}
                  >
                    <ArrowUpRight size={17} />
                    View treatment course
                  </button>
                )}
              {canBook(role) && selected.status === "Confirmed" && (
                <button onClick={() => checkIn(selected)}>
                  <Check size={17} />
                  Check in patient
                </button>
              )}
              {canClinical(role) && selected.status === "Checked in" && (
                <button onClick={() => openWorkspace(selected)}>
                  <Play size={17} />
                  Start session
                </button>
              )}
              {canBook(role) &&
                !["Completed", "Cancelled", "In progress"].includes(
                  selected.status,
                ) && (
                  <button onClick={() => setAction("reschedule")}>
                    <Clock size={17} />
                    Reschedule
                  </button>
                )}
              {canBook(role) &&
                !["Completed", "Cancelled", "In progress"].includes(
                  selected.status,
                ) && (
                  <button onClick={() => setAction("cancel")}>
                    <Clock size={17} />
                    Cancel appointment
                  </button>
                )}
              {canClinical(role) && selected.status !== "Checked in" && (
                <button
                  onClick={() => {
                    openWorkspace(selected);
                  }}
                >
                  <Check size={17} />
                  Open session workspace
                </button>
              )}
              {!["Completed", "Cancelled"].includes(selected.status) && (
                <p className="muted small-text">
                  Available actions reflect your demo role and the visit status.
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={submit}>
              {action === "cancel" ? (
                <p>
                  Cancel this appointment? The patient will be removed from the
                  active treatment queue.
                </p>
              ) : (
                <div className="form-grid">
                  <label>
                    New date
                    <input
                      name="date"
                      type="date"
                      defaultValue={selected.date}
                      required
                    />
                  </label>
                  <label>
                    New time (IST)
                    <input
                      name="time"
                      type="time"
                      defaultValue={selected.time}
                      required
                    />
                  </label>
                </div>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setAction("")}
                >
                  Back
                </button>
                <button className="button primary">
                  {action === "cancel"
                    ? "Confirm cancellation"
                    : "Confirm reschedule"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </section>
  );
}
