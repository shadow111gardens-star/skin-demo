import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal, Badge } from "../../components";
import { useClinic } from "../../store";
import { DEMO_DATE, type RecordItem } from "../../data";
import { canBook, type Role } from "../../auth";
import { doctors } from "../../patientServices";
import {
  contactAction,
  upsertFollowup,
  followupData,
  reminderPaused,
  reminderText,
  suggestedDate,
} from "./services";
import AppointmentForm from "./AppointmentForm";
import AppointmentDrawer from "./AppointmentDrawer";
export default function FollowupDetail({
  record: r,
  role,
  onClose,
}: {
  record: RecordItem;
  role: Role;
  onClose: () => void;
}) {
  const { state, setState, notify } = useClinic(),
    navigate = useNavigate();
  const [action, setAction] = useState(""),
    [note, setNote] = useState(""),
    [due, setDue] = useState(r.dueDate || ""),
    [employee, setEmployee] = useState(
      role === "Doctor" ? "Dr. Mehta" : "Riya Malhotra",
    ),
    [error, setError] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [draft, setDraft] = useState(
      () => r.followup?.reminderDraft || reminderText(state, r),
    ),
    [booking, setBooking] = useState(false),
    [appointmentId, setAppointmentId] = useState("");
  const d = followupData(r),
    p = state.patients.find((p) => p.id === r.patientId),
    c = state.records["Treatment Plans"].find((c) => c.id === r.courseId),
    actual =
      state.appointments.find(
        (a) => a.id === (r.appointmentId || d.appointmentId),
      ) ||
      state.appointments
        .filter(
          (a) =>
            a.patientId === r.patientId &&
            (!r.courseId || a.courseId === r.courseId) &&
            !["Cancelled", "No-show", "Completed", "Waiting list"].includes(
              a.status,
            ),
        )
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0],
    paused = reminderPaused(state, r),
    closed = ["Completed", "Declined"].includes(r.status),
    last = state.records["Sittings & Sessions"]
      .filter(
        (v) =>
          v.patientId === r.patientId &&
          (!r.courseId || v.courseId === r.courseId) &&
          v.status === "Completed",
      )
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
  function begin(a: string) {
    setAction(a);
    setNote("");
    setError("");
    setConfirmed(false);
    setDue(r.dueDate || "");
    if (
      ["Escalate to Doctor", "Override recommended date"].includes(a) ||
      (a === "Mark Resolved" && /reaction/i.test(r.followupKind || ""))
    )
      setEmployee(c?.course?.approvingDoctor || doctors[0]);
  }
  function save() {
    try {
      if (["Mark Resolved", "Record Declined"].includes(action) && !confirmed)
        throw new Error("Confirm this outcome first.");
      if (action === "Draft WhatsApp Reminder" && (paused || closed))
        throw new Error(
          "Routine reminders are paused or this follow-up is closed.",
        );
      if (
        action === "Override recommended date" &&
        !["Doctor", "Clinic Owner"].includes(role)
      )
        throw new Error("A clinician must approve the date override.");
      if (
        action === "Mark Resolved" &&
        /reaction/i.test(r.followupKind || "") &&
        !["Doctor", "Clinic Owner"].includes(role)
      )
        throw new Error("A clinician must resolve a reaction review.");
      if (action === "Draft WhatsApp Reminder" && !draft.trim())
        throw new Error("Enter a reminder draft before saving.");
      const who = employee;
      const text =
        action === "Draft WhatsApp Reminder"
          ? "Reminder draft prepared; no delivery claimed. " + note
          : note;
      const next = contactAction(
        upsertFollowup(state, {
          ...r,
          followup: {
            ...d,
            reminderDraft:
              action === "Draft WhatsApp Reminder" ? draft : d.reminderDraft,
          },
        }),
        r.id,
        action,
        text,
        who,
        action === "Override recommended date" ? due : undefined,
      );
      localStorage.setItem("mmverse-v1", JSON.stringify(next));
      setState(next);
      notify(
        action === "Draft WhatsApp Reminder"
          ? "Draft saved in contact history; nothing sent"
          : "Follow-up updated",
      );
      setAction("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <Modal
        title="Follow-up workspace"
        className="followup-drawer"
        onClose={onClose}
      >
        <div className="appointment-drawer-patient">
          <button
            className="text-button"
            onClick={() => navigate("/patients/" + r.patientId)}
          >
            {r.name} ↗
          </button>
          <small>{r.patientId}</small>
          <Badge>{r.status}</Badge>
        </div>
        {paused && (
          <div className="schedule-warning">
            <strong>Routine reminders paused</strong>
            <p>
              {c?.status === "Paused"
                ? "This treatment course is paused."
                : "An adverse reaction requires clinician review."}{" "}
              Operational contact and clinician escalation remain available.
            </p>
          </div>
        )}
        <dl className="schedule-detail-grid">
          {Object.entries({
            Reason: r.detail,
            Course:
              c?.course?.treatmentName || r.courseId || "No course linked",
            "Last sitting": last
              ? `${last.date} · sitting ${last.session?.number || "—"}`
              : "No completed sitting recorded",
            "Suggested date": suggestedDate(state, r),
            "Recommended date": r.dueDate || "Not set",
            "Assigned employee": d.assignedTo,
            Outcome: d.outcome,
            "Next action": d.nextAction,
            "Contact preference":
              p?.communicationPreference || "Confirm with patient",
            "Communication consent": p?.consentStatus || "Not recorded",
          }).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {actual ? (
          <button
            className="button secondary"
            onClick={() => setAppointmentId(actual.id)}
          >
            Open appointment · {actual.date} {actual.time} · {actual.status}
          </button>
        ) : (
          <p className="clinical-footnote">
            No actual appointment linked or upcoming. A recommended date does
            not reserve a slot.
          </p>
        )}
        <div className="drawer-action-grid">
          {[
            "Call",
            "Draft WhatsApp Reminder",
            "Mark Contacted",
            "Record Declined",
            "Escalate to Doctor",
            "Mark Resolved",
          ].map((a) => (
            <button
              className="button secondary"
              key={a}
              disabled={
                closed ||
                (a === "Draft WhatsApp Reminder" && paused) ||
                (a === "Mark Resolved" &&
                  /reaction/i.test(r.followupKind || "") &&
                  !["Doctor", "Clinic Owner"].includes(role))
              }
              onClick={() => begin(a)}
            >
              {a}
            </button>
          ))}
          {canBook(role) && !closed && (
            <button
              className="button primary"
              onClick={() =>
                actual ? setAppointmentId(actual.id) : setBooking(true)
              }
            >
              {actual ? "Reschedule appointment" : "Schedule Appointment"}
            </button>
          )}
          {["Doctor", "Clinic Owner"].includes(role) && !closed && (
            <button
              className="button secondary"
              onClick={() => begin("Override recommended date")}
            >
              Override recommended date
            </button>
          )}
        </div>
        <h3>Contact history</h3>
        <ol className="schedule-audit">
          {d.contacts.map((e) => (
            <li key={e.id}>
              <strong>
                {e.action} · {e.outcome}
              </strong>
              <small>
                {new Date(e.at).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}{" "}
                IST · {e.employee}
              </small>
              <p>{e.note}</p>
            </li>
          ))}
        </ol>
        {!d.contacts.length && (
          <p className="clinical-footnote">
            No contact attempt recorded. No call or message is assumed.
          </p>
        )}
      </Modal>
      {booking && (
        <AppointmentForm
          initialPatientId={r.patientId}
          initialCourseId={c?.status === "Active" ? c.id : undefined}
          followupId={r.id}
          date={(r.dueDate || DEMO_DATE) < DEMO_DATE ? DEMO_DATE : r.dueDate}
          onClose={() => setBooking(false)}
        />
      )}
      {appointmentId && (
        <AppointmentDrawer
          id={appointmentId}
          role={role}
          onClose={() => setAppointmentId("")}
        />
      )}
      {action && (
        <Modal
          title={action}
          className="followup-action-modal"
          onClose={() => setAction("")}
        >
          <div className="clinical-form">
            {action === "Call" && (
              <div className="schedule-neutral">
                <p>
                  Call task for {p?.phone}. This demo has not placed or
                  connected a call.
                </p>
                <a className="button secondary" href={"tel:" + p?.phone}>
                  Open phone dialler
                </a>
              </div>
            )}
            {action === "Draft WhatsApp Reminder" && (
              <>
                <p className="schedule-neutral">
                  Simulated editable draft. No message is delivered. Routine
                  copy omits treatment, course, reaction and other medical
                  details.
                </p>
                <label>
                  Reminder draft
                  <textarea
                    aria-label="Reminder draft"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                </label>
                <button
                  className="button secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(draft);
                      notify("Reminder draft copied; not sent");
                    } catch {
                      setError(
                        "Copy is unavailable. Select and copy the editable text.",
                      );
                    }
                  }}
                >
                  Copy reminder draft
                </button>
              </>
            )}
            {action === "Override recommended date" && (
              <>
                <p>
                  Suggested from the last completed sitting and the
                  clinician-approved course interval: {suggestedDate(state, r)}.
                  Record the clinician reason for any override.
                </p>
                <label>
                  Recommended date
                  <input
                    aria-label="Follow-up next date"
                    type="date"
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                  />
                </label>
              </>
            )}
            <label>
              Assigned employee
              <select
                aria-label="Follow-up employee"
                value={employee}
                onChange={(e) => setEmployee(e.target.value)}
              >
                {["Riya Malhotra", ...doctors, "Aarav Singh", "Neha Rao"].map(
                  (e) => (
                    <option key={e}>{e}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              Contact note / outcome
              <textarea
                aria-label="Contact note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Record the actual outcome; do not assume contact or delivery"
              />
            </label>
            {["Mark Resolved", "Record Declined"].includes(action) && (
              <label className="session-checkbox">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Confirm this outcome and stop routine reminders for this
                follow-up.
              </label>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button
                className="button secondary"
                onClick={() => setAction("")}
              >
                Cancel
              </button>
              <button className="button primary" onClick={save}>
                Save outcome
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
