import { clinicDoctors, clinicTechnicians } from "../admin/access";
import { machineRestriction } from "../operations/selectors";
import { useState } from "react";
import { Modal } from "../../components";
import { useClinic } from "../../store";
import { DEMO_DATE, type Appointment } from "../../data";
import { doctors } from "../../patientServices";
import { technicians } from "../clinical/model";
import { DiscardDialog } from "../clinical/ClinicalComponents";
import {
  bookingErrors,
  alternatives,
  saveAppointment,
  treatmentConfig,
} from "./services";
export default function AppointmentForm({
  appointment,
  initialPatientId = "",
  initialCourseId = "",
  date = DEMO_DATE,
  followupId,
  source = "Clinic desk",
  onClose,
  onSaved,
}: {
  appointment?: Appointment;
  initialPatientId?: string;
  initialCourseId?: string;
  date?: string;
  followupId?: string;
  source?: string;
  onClose: () => void;
  onSaved?: (a: Appointment) => void;
}) {
  const { state, setState, notify } = useClinic();
  const [draft, setDraft] = useState<Appointment>(() => {
    const p =
        state.patients.find((p) => p.id === initialPatientId) ||
        state.patients[0],
      c = state.records["Treatment Plans"].find(
        (c) => c.id === initialCourseId && c.patientId === p?.id,
      );
    return appointment
      ? structuredClone(appointment)
      : {
          id: "APT-" + crypto.randomUUID().slice(0, 8),
          patientId: p?.id || "",
          date,
          time: "14:00",
          duration: c?.course
            ? state.records["Treatment Catalogue"].find(
                (t) => t.id === c.course?.treatmentId,
              )?.treatment?.duration ||
              state.adminSettings?.defaultAppointmentMinutes ||
              45
            : state.adminSettings?.defaultAppointmentMinutes || 45,
          treatment: c?.course?.treatmentName || p?.treatment || "",
          doctor: c?.course?.assignedDoctor || p?.assignedDoctor || doctors[0],
          technician: c?.course?.technician || technicians[0],
          room: "Room 01",
          machineId: c?.course
            ? state.records["Treatment Catalogue"].find(
                (t) => t.id === c.course?.treatmentId,
              )?.treatment?.machineIds[0] || ""
            : "",
          courseId: c?.id,
          status: "Confirmed",
          sitting: c ? (c.completedSittings || 0) + 1 : 1,
          totalSittings: c?.totalSittings || 1,
          bookingSource: followupId ? "Follow-up" : source,
          notes: "",
        };
  });
  const [step, setStep] = useState(0),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [discard, setDiscard] = useState(false),
    [reason, setReason] = useState(
      appointment ? "" : "Patient-requested clinic appointment",
    ),
    [busy, setBusy] = useState(false);
  const courses = state.records["Treatment Plans"].filter(
      (c) => c.patientId === draft.patientId && c.status === "Active",
    ),
    config = treatmentConfig(state, draft),
    errors = bookingErrors(state, draft),
    slots = errors.length ? alternatives(state, draft) : [];
  const change = (v: Partial<Appointment>) => {
    setDraft((d) => ({ ...d, ...v }));
    setDirty(true);
    setError("");
  };
  const close = () => (dirty ? setDiscard(true) : onClose());
  function goToStep(next: number) {
    if (next > step && (!state.patients.some(p => p.id === draft.patientId && p.status !== "Archived") || !draft.treatment.trim())) {
      setError("Select a registered patient and treatment before continuing.");
      setStep(0);
      return;
    }
    if (next > 1 && errors.length) {
      setError(errors.join(" "));
      setStep(1);
      return;
    }
    setError("");
    setStep(next);
  }
  function review() {
    if (errors.length) {
      setError(errors.join(" "));
      setStep(1);
      return;
    }
    if (!reason.trim()) {
      setError("Enter a booking or change note.");
      return;
    }
    setConfirm(true);
  }
  function save() {
    try {
      setBusy(true);
      const next = saveAppointment(
        state,
        draft,
        "Clinic desk",
        reason,
        followupId,
      );
      localStorage.setItem("mmverse-v1", JSON.stringify(next));
      setState(next);
      notify(
        draft.status === "Waiting list"
          ? "Added to waiting list; no resources reserved"
          : appointment
            ? "Appointment updated; sitting balance unchanged"
            : "Appointment booked",
      );
      onSaved?.(draft);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Modal
        title={appointment ? "Edit appointment" : "Book appointment"}
        className="booking-modal"
        onClose={close}
      >
        <div className="booking-intro">
          Asia/Kolkata · Fictional clinic schedule · Availability is checked
          again when saved.
        </div>
        <nav className="booking-steps" aria-label="Booking steps">
          {["Patient & visit", "Time & resources", "Review booking"].map(
            (label, i) => (
              <button
                key={label}
                aria-current={step === i ? "step" : undefined}
                onClick={() => goToStep(i)}
              >
                {i + 1} {label}
              </button>
            ),
          )}
        </nav>
        <div className="clinical-form">
          {step === 0 && (
            <div className="clinical-fields">
              <label>
                Patient
                <select
                  aria-label="Patient"
                  disabled={!!appointment || !!initialPatientId}
                  value={draft.patientId}
                  onChange={(e) => {
                    const p = state.patients.find(
                      (p) => p.id === e.target.value,
                    )!;
                    change({
                      patientId: p.id,
                      courseId: undefined,
                      treatment: p.treatment,
                      doctor: p.assignedDoctor || doctors[0],
                      machineId: "",
                      sitting: 1,
                      totalSittings: 1,
                    });
                  }}
                >
                  {state.patients
                    .filter((p) => p.status !== "Archived")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.id}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Visit type
                <select
                  aria-label="Visit type"
                  value={
                    draft.status === "Waiting list"
                      ? "Waiting list"
                      : draft.bookingSource || "Clinic desk"
                  }
                  onChange={(e) =>
                    change({
                      bookingSource: e.target.value,
                      status:
                        e.target.value === "Waiting list"
                          ? "Waiting list"
                          : "Confirmed",
                    })
                  }
                >
                  {[
                    ...new Set([
                      draft.bookingSource || "Clinic desk",
                      "Clinic desk",
                      "Walk-in",
                      "Follow-up",
                      "Waiting list",
                      "Online enquiry",
                    ]),
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Treatment course
                <select
                  aria-label="Treatment course"
                  value={draft.courseId || ""}
                  disabled={!!appointment || !!initialCourseId}
                  onChange={(e) => {
                    const c = courses.find((c) => c.id === e.target.value);
                    change(
                      c
                        ? {
                            courseId: c.id,
                            treatment: c.course?.treatmentName || c.detail,
                            sitting: (c.completedSittings || 0) + 1,
                            totalSittings: c.totalSittings,
                            doctor: c.course?.assignedDoctor || draft.doctor,
                            technician:
                              c.course?.technician || draft.technician,
                            machineId:
                              state.records["Treatment Catalogue"].find(
                                (t) => t.id === c.course?.treatmentId,
                              )?.treatment?.machineIds[0] || "",
                          }
                        : { courseId: undefined, sitting: 1, totalSittings: 1 },
                    );
                  }}
                >
                  <option value="">Single visit / no package deduction</option>
                  {courses.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.course?.treatmentName || c.detail} ·{" "}
                      {c.completedSittings}/{c.totalSittings}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Treatment
                <select
                  aria-label="Treatment"
                  value={draft.treatment}
                  disabled={!!draft.courseId}
                  onChange={(e) => {
                    const t = state.records["Treatment Catalogue"].find(
                      (t) => t.name === e.target.value,
                    );
                    change({
                      treatment: e.target.value,
                      duration:
                        t?.treatment?.duration ||
                        state.adminSettings?.defaultAppointmentMinutes ||
                        45,
                      machineId: "",
                    });
                  }}
                >
                  {[
                    ...new Set([
                      draft.treatment,
                      ...state.records["Treatment Catalogue"]
                        .filter((t) => t.status !== "Inactive")
                        .map((t) => t.name),
                    ]),
                  ]
                    .filter(Boolean)
                    .map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                </select>
              </label>
              <label>
                Sitting number
                <input readOnly value={draft.sitting || 1} />
              </label>
              <label>
                Duration (minutes)
                <input
                  aria-label="Duration (minutes)"
                  type="number"
                  min="5"
                  max="480"
                  value={draft.duration || ""}
                  onChange={(e) => change({ duration: Number(e.target.value) })}
                />
              </label>
            </div>
          )}
          {step === 1 && (
            <>
              <div className="clinical-fields">
                <label>
                  Appointment date
                  <input
                    aria-label="Appointment date"
                    type="date"
                    value={draft.date}
                    min={DEMO_DATE}
                    onChange={(e) =>
                      change({
                        date: e.target.value,
                        status:
                          draft.status === "Waiting list"
                            ? "Waiting list"
                            : "Confirmed",
                      })
                    }
                  />
                </label>
                <label>
                  Time (IST)
                  <input
                    aria-label="Time (IST)"
                    type="time"
                    value={draft.time}
                    onChange={(e) =>
                      change({
                        time: e.target.value,
                        status:
                          draft.status === "Waiting list"
                            ? "Waiting list"
                            : "Confirmed",
                      })
                    }
                  />
                </label>
                <label>
                  Doctor
                  <select
                    aria-label="Doctor"
                    value={draft.doctor}
                    onChange={(e) => change({ doctor: e.target.value })}
                  >
                    {clinicDoctors(state).map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Technician
                  <select
                    aria-label="Technician"
                    value={draft.technician || ""}
                    onChange={(e) => change({ technician: e.target.value })}
                  >
                    <option value="">Not assigned</option>
                    {clinicTechnicians(state)
                      .filter((t) => t !== "Not assigned")
                      .map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                  </select>
                </label>
                <label>
                  Room
                  <select
                    aria-label="Room"
                    value={draft.room || ""}
                    onChange={(e) => change({ room: e.target.value })}
                  >
                    <option value="">Not assigned</option>
                    {state.records["Rooms & Resources"].map((r) => (
                      <option
                        key={r.id}
                        value={r.room!.code}
                        disabled={r.status !== "Available"}
                      >
                        {r.room!.code}
                        {r.status !== "Available" ? " (Unavailable)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Machine
                  <select
                    aria-label="Machine"
                    value={draft.machineId || ""}
                    onChange={(e) => change({ machineId: e.target.value })}
                  >
                    <option value="">No machine / select if required</option>
                    {state.records["Machines & Equipment"].map((m) => (
                      <option
                        key={m.id}
                        value={m.id}
                        disabled={!!machineRestriction(state, m.id)}
                      >
                        {m.name}
                        {config && !config.machineIds.includes(m.id)
                          ? " · Incompatible"
                          : ""}
                        {!!machineRestriction(state, m.id)
                          ? " · Unavailable"
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div
                className={
                  "availability-panel " +
                  (errors.length ? "blocked" : "available")
                }
              >
                <strong>
                  {draft.status === "Waiting list"
                    ? "Waiting list · no slot reserved"
                    : errors.length
                      ? "Availability needs attention"
                      : "Selected resources are available"}
                </strong>
                {errors.map((e) => (
                  <p key={e}>{e}</p>
                ))}
                {!!slots.length && (
                  <>
                    <small>
                      Available alternatives for the selected resources
                    </small>
                    <div className="available-slots">
                      {slots.map((a) => (
                        <button
                          key={a.date + a.time}
                          onClick={() => change({ date: a.date, time: a.time })}
                        >
                          {a.date} · {a.time}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {errors.length > 0 && !slots.length && (
                  <p>
                    Change the resource selection, open an existing course
                    booking, or choose Waiting list. Conflicts are never
                    overridden.
                  </p>
                )}
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div className="booking-review">
                <strong>
                  {state.patients.find((p) => p.id === draft.patientId)?.name}
                </strong>
                <p>
                  {draft.treatment} · sitting {draft.sitting || 1} ·{" "}
                  {draft.date} at {draft.time} IST · {draft.duration} min
                </p>
                <p>
                  {draft.doctor} / {draft.technician || "Unassigned"} /{" "}
                  {draft.room || "Unassigned"}
                </p>
                <p>
                  {state.records["Machines & Equipment"].find(
                    (m) => m.id === draft.machineId,
                  )?.name || "No machine"}{" "}
                  · {draft.status}
                </p>
              </div>
              <label>
                Appointment notes
                <textarea
                  aria-label="Appointment notes"
                  value={draft.notes || ""}
                  onChange={(e) => change({ notes: e.target.value })}
                />
              </label>
              <label>
                Booking / change reason
                <textarea
                  aria-label="Booking reason"
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setDirty(true);
                  }}
                />
              </label>
              <p className="clinical-footnote">
                Booking, waiting-list and schedule changes do not consume a
                sitting. Clinical completion happens in Sittings & Sessions.
              </p>
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button className="button secondary" onClick={close}>
              Cancel
            </button>
            {step > 0 && (
              <button
                className="button secondary"
                onClick={() => setStep(step - 1)}
              >
                Back
              </button>
            )}
            {step < 2 ? (
              <button
                className="button primary"
                onClick={() => goToStep(step + 1)}
              >
                Continue
              </button>
            ) : (
              <button className="button primary" onClick={review}>
                {appointment ? "Review changes" : "Confirm booking"}
              </button>
            )}
          </div>
        </div>
      </Modal>
      {confirm && (
        <Modal
          title={
            appointment
              ? "Confirm appointment changes"
              : "Confirm appointment booking"
          }
          onClose={() => setConfirm(false)}
        >
          <p>
            {draft.date} · {draft.time} IST · {draft.duration} min.{" "}
            {draft.status === "Waiting list"
              ? "No resources will be reserved."
              : "The selected resources will be reserved."}{" "}
            No package unit is deducted.
          </p>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => setConfirm(false)}
            >
              Keep editing
            </button>
            <button className="button primary" disabled={busy} onClick={save}>
              {busy ? "Saving…" : "Save appointment"}
            </button>
          </div>
        </Modal>
      )}
      {discard && (
        <DiscardDialog onKeep={() => setDiscard(false)} onDiscard={onClose} />
      )}
    </>
  );
}
