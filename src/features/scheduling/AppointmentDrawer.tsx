import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal, Badge } from "../../components";
import { useClinic } from "../../store";
import { canBook, type Role } from "../../auth";
import { appointmentAction } from "./services";
import { ensureSession } from "../sessions/sessionData";
import AppointmentForm from "./AppointmentForm";
export default function AppointmentDrawer({
  id,
  role,
  onClose,
}: {
  id: string;
  role: Role;
  onClose: () => void;
}) {
  const { state, setState, notify } = useClinic(),
    navigate = useNavigate();
  const a = state.appointments.find((a) => a.id === id);
  const [edit, setEdit] = useState(false),
    [action, setAction] = useState(""),
    [reason, setReason] = useState(""),
    [error, setError] = useState("");
  if (!a) return null;
  const p = state.patients.find((p) => p.id === a.patientId),
    session = state.records["Sittings & Sessions"].find(
      (r) => r.appointmentId === id,
    ),
    locked = ["Completed", "In progress", "Awaiting review"].includes(a.status);
  function update(status: "Cancelled" | "No-show") {
    try {
      const next = appointmentAction(state, id, status, reason, role);
      localStorage.setItem("mmverse-v1", JSON.stringify(next));
      setState(next);
      notify(status + "; sitting balance unchanged");
      setAction("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <Modal
        title="Appointment details"
        className="appointment-drawer"
        onClose={onClose}
      >
        <div className="appointment-drawer-patient">
          <button
            className="text-button"
            onClick={() => navigate("/patients/" + a.patientId)}
          >
            {p?.name} ↗
          </button>
          <small>{a.patientId}</small>
          <Badge>{a.status}</Badge>
        </div>
        <h3>{a.treatment}</h3>
        <dl className="schedule-detail-grid">
          {Object.entries({
            "Date / time": `${a.date} · ${a.time} IST`,
            Duration: `${a.duration || 45} minutes`,
            Course: a.courseId || "Single visit",
            Sitting: a.sitting || 1,
            Doctor: a.doctor,
            Technician: a.technician || "Not assigned",
            Room: a.room || "Not assigned",
            Machine:
              state.records["Machines & Equipment"].find(
                (m) => m.id === a.machineId,
              )?.name || "Not required / not assigned",
            "Booking source": a.bookingSource || "Clinic desk",
            Notes: a.notes || "No appointment notes recorded",
          }).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {a.courseId && (
          <button
            className="button secondary"
            onClick={() => navigate("/treatment-plans/courses/" + a.courseId)}
          >
            View course
          </button>
        )}
        <div className="drawer-action-grid">
          {canBook(role) && !locked && (
            <>
              <button className="button primary" onClick={() => setEdit(true)}>
                {a.status === "Waiting list"
                  ? "Allocate appointment"
                  : "Edit / reschedule"}
              </button>
              {!["Cancelled", "No-show"].includes(a.status) && (
                <>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setAction("Cancelled");
                      setReason("");
                      setError("");
                    }}
                  >
                    Cancel appointment
                  </button>
                  {a.status !== "Waiting list" && (
                    <button
                      className="button secondary"
                      onClick={() => {
                        setAction("No-show");
                        setReason("");
                        setError("");
                      }}
                    >
                      Mark no-show
                    </button>
                  )}
                </>
              )}
            </>
          )}
          {a.status !== "Waiting list" && (
            <button
              className="button secondary"
              onClick={() => {
                const linked = ensureSession(state, id);
                setState(linked.state);
                navigate(
                  "/sittings-sessions/" + (session?.id || linked.record.id),
                );
              }}
            >
              Open session workspace
            </button>
          )}
        </div>
        <h3>Booking history</h3>
        <ol className="schedule-audit">
          {(a.audit || []).map((e, i) => (
            <li key={i}>
              <strong>{e.action}</strong>
              <small>
                {new Date(e.at).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                }) + " IST"}{" "}
                · {e.actor}
              </small>
              <p>{e.note}</p>
            </li>
          ))}
        </ol>
        {!a.audit?.length && (
          <p className="clinical-footnote">
            Imported fictional booking; no prior schedule edits recorded.
          </p>
        )}
      </Modal>
      {edit && (
        <AppointmentForm appointment={a} onClose={() => setEdit(false)} />
      )}
      {action && (
        <Modal
          title={
            action === "Cancelled"
              ? "Cancel appointment?"
              : "Mark appointment no-show?"
          }
          onClose={() => setAction("")}
        >
          <p>
            The existing appointment and audit history are retained. No sitting
            or payment is consumed.
          </p>
          <label>
            Reason
            <textarea
              aria-label="Status change reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button className="button secondary" onClick={() => setAction("")}>
              Keep appointment
            </button>
            <button
              className="button danger"
              onClick={() => update(action as "Cancelled" | "No-show")}
            >
              Confirm status change
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
