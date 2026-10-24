import { useState, useRef, type FormEvent } from "react";
import { DiscardDialog } from "../clinical/ClinicalComponents";
import { Modal } from "../../components";
import { type Patient, DEMO_DATE, type ClinicalInfo } from "../../data";
import { useClinic, addActivity } from "../../store";
import { clinicDoctors } from "../admin/access";
export default function ClinicalEditor({
  patient,
  onClose,
}: {
  patient: Patient;
  onClose: () => void;
}) {
  const { state, setState, notify } = useClinic();
  const [values, setValues] = useState({
    history: patient.clinical?.history || "",
    allergies: patient.clinical?.allergies || "",
    medications: patient.clinical?.medications || "",
    procedures: patient.clinical?.procedures || "",
    alerts: patient.clinical?.alerts.join("\n") || "",
    doctor: patient.assignedDoctor || clinicDoctors(state)[0] || "",
  });
  const initial = useRef(JSON.stringify(values));
  const [discard, setDiscard] = useState(false);
  const close = () => JSON.stringify(values) !== initial.current ? setDiscard(true) : onClose();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const clinical: ClinicalInfo = {
      history: values.history.trim(),
      allergies: values.allergies.trim(),
      medications: values.medications.trim(),
      procedures: values.procedures.trim(),
      alerts: values.alerts
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      reviewedBy: values.doctor,
      reviewedAt: DEMO_DATE,
    };
    setState((s) =>
      addActivity(
        {
          ...s,
          patients: s.patients.map((p) =>
            p.id === patient.id ? { ...p, clinical } : p,
          ),
        },
        `${patient.name}: clinical history reviewed by ${values.doctor}.`,
        patient.id,
      ),
    );
    notify("Reviewed clinical history saved");
    onClose();
  }
  return (
    <>
    <Modal
      title="Review clinical history"
      className="patient-form-modal"
      onClose={close}
    >
      <p className="muted">
        {patient.name} · {patient.id}
      </p>
      <form onSubmit={submit}>
        <div className="registration-grid">
          {(["history", "allergies", "medications", "procedures"] as const).map(
            (key, i) => (
              <label key={key}>
                {
                  [
                    "Medical history",
                    "Allergies",
                    "Current medications",
                    "Previous procedures",
                  ][i]
                }
                <textarea
                  value={values[key]}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [key]: e.target.value }))
                  }
                  required
                  minLength={3}
                />
              </label>
            ),
          )}
        </div>
        <label>
          Important alerts (one per line)
          <textarea
            value={values.alerts}
            onChange={(e) =>
              setValues((v) => ({ ...v, alerts: e.target.value }))
            }
            placeholder="Record clinician-reviewed precautions. Leave blank if none reported."
          />
        </label>
        <label>
          Reviewing clinician
          <select
            required
            value={values.doctor}
            onChange={(e) =>
              setValues((v) => ({ ...v, doctor: e.target.value }))
            }
          >
            {clinicDoctors(state).map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="checkbox">
          <input type="checkbox" required />
          The treating clinician has reviewed this history and these alerts.
        </label>
        <div className="info-strip">
          Record existing clinician-reviewed information only. This form does
          not generate prescriptions or clinical recommendations.
        </div>
        <div className="form-actions">
          <button className="button secondary" type="button" onClick={close}>
            Cancel
          </button>
          <button className="button primary">Save reviewed history</button>
        </div>
      </form>
    </Modal>
    {discard && <DiscardDialog onKeep={() => setDiscard(false)} onDiscard={onClose} />}
    </>
  );
}
