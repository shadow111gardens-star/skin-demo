import { useState } from "react";
import { useClinic } from "../../store";
import { Modal } from "../../components";
import { ensureSession } from "./sessionData";
import type { RecordItem } from "../../data";
export default function SessionEntry({
  initialPatientId = "",
  initialCourseId = "",
  onClose,
  onOpen,
}: {
  initialPatientId?: string;
  initialCourseId?: string;
  onClose: () => void;
  onOpen?: (r: RecordItem) => void;
}) {
  const { state, setState, notify } = useClinic();
  const [patientId, setPatient] = useState(
    initialPatientId || state.patients[0]?.id || "",
  );
  const [appointmentId, setAppointment] = useState("");
  const [error, setError] = useState("");
  const visits = state.appointments.filter(
    (a) =>
      a.patientId === patientId &&
      (!initialCourseId || a.courseId === initialCourseId) &&
      !["Completed", "Cancelled", "No-show", "Waiting list"].includes(a.status),
  );
  return (
    <Modal
      title="Record sitting"
      className="patient-workflow-modal"
      onClose={onClose}
    >
      <div className="clinical-form">
        <p>
          Open the existing appointment’s clinical workspace. Consent,
          preparation, procedure documentation and clinician completion review
          are recorded there.
        </p>
        <label>
          Patient
          <select
            aria-label="Patient"
            disabled={!!initialPatientId}
            value={patientId}
            onChange={(e) => {
              setPatient(e.target.value);
              setAppointment("");
            }}
          >
            {state.patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} | {p.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Appointment
          <select
            aria-label="Appointment"
            value={appointmentId}
            onChange={(e) => setAppointment(e.target.value)}
          >
            <option value="">Select appointment</option>
            {visits.map((a) => (
              <option key={a.id} value={a.id}>
                {a.date} {a.time} | {a.treatment} | {a.status}
              </option>
            ))}
          </select>
        </label>
        {!visits.length && (
          <p className="clinical-pending">
            No eligible appointment exists for this patient. Book an appointment
            first.
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            onClick={() => {
              try {
                const linked = ensureSession(state, appointmentId);
                localStorage.setItem(
                  "mmverse-v1",
                  JSON.stringify(linked.state),
                );
                setState(linked.state);
                notify("Existing sitting opened; package balance unchanged");
                onClose();
                onOpen?.(linked.record);
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            Open session workspace
          </button>
        </div>
      </div>
    </Modal>
  );
}
