import { useState, type ReactNode } from "react";
import { Avatar, Badge, Modal } from "../../components";
import { useClinic, addActivity } from "../../store";
import type { Patient, ClinicState } from "../../data";
export function ClinicalNotice() {
  return (
    <div className="clinical-notice">
      Fictional demo records. Clinical decisions are entered and approved by a
      clinician. Intervals, prices and machine compatibility are configurable
      clinic defaults.
    </div>
  );
}
export function PatientContext({
  patient,
  reactions,
  onPatient,
}: {
  patient?: Patient;
  reactions?: string;
  onPatient?: (id: string) => void;
}) {
  if (!patient)
    return (
      <aside className="card clinical-context">
        <h3>Patient context</h3>
        <p>Select an existing patient to keep their care history connected.</p>
      </aside>
    );
  return (
    <aside className="card clinical-context">
      <button
        className="patient-cell"
        disabled={!onPatient}
        onClick={() => onPatient?.(patient.id)}
      >
        <Avatar name={patient.name} />
        <span>
          <strong>{patient.name}</strong>
          <small>
            {patient.id} | {patient.age} years
          </small>
        </span>
      </button>
      <Badge>{patient.status}</Badge>
      <dl>
        {[
          ["Allergies", patient.clinical?.allergies],
          ["Relevant history", patient.clinical?.history],
          ["Current medications", patient.clinical?.medications],
          ["Previous procedures", patient.clinical?.procedures],
          ["Previous reactions", reactions],
        ].map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v || "Not recorded — confirm with the patient."}</dd>
          </div>
        ))}
      </dl>
      <small>
        Clinician reviewed: {patient.clinical?.reviewedBy || "Review pending"}
      </small>
    </aside>
  );
}
export function FormSection({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker?: string;
  children: ReactNode;
}) {
  return (
    <section className="card clinical-form-section">
      <header>
        {kicker && <span>{kicker}</span>}
        <h2>{title}</h2>
      </header>
      <div>{children}</div>
    </section>
  );
}
export function DiscardDialog({
  onKeep,
  onDiscard,
}: {
  onKeep: () => void;
  onDiscard: () => void;
}) {
  return (
    <Modal title="Discard unsaved clinical changes?" onClose={onKeep}>
      <p>
        Your saved records will be retained. Discard the changes in this form?
      </p>
      <div className="form-actions">
        <button className="button secondary" onClick={onKeep}>
          Keep editing
        </button>
        <button className="button danger" onClick={onDiscard}>
          Discard changes
        </button>
      </div>
    </Modal>
  );
}
export function useClinicalSave() {
  const { state, setState, notify } = useClinic();
  const [error, setError] = useState("");
  function save(next: ClinicState, message: string, patientId?: string) {
    try {
      const updated = addActivity(next, message, patientId);
      localStorage.setItem("mmverse-v1", JSON.stringify(updated));
      setState(updated);
      setError("");
      notify(message);
      return true;
    } catch {
      setError(
        "Could not save these changes. Free browser storage and try again.",
      );
      notify("Clinical changes were not saved.", "error");
      return false;
    }
  }
  return { state, save, error, setError, notify };
}
