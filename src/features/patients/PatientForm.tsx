import { clinicDoctors } from "../admin/access";
import { useState, type FormEvent } from "react";
import {
  UserRoundPlus,
  ShieldCheck,
  CopyCheck,
  ArrowUpRight,
  AlertCircle,
} from "lucide-react";
import { Modal } from "../../components";
import { DEMO_DATE, type Patient } from "../../data";
import { useClinic, addActivity } from "../../store";
import {
  calculateAge,
  doctors,
  generatePatientId,
  likelyDuplicates,
  validEmail,
  validPhone,
  updatePatient,
} from "../../patientServices";
interface Props {
  patient?: Patient;
  onClose: () => void;
  onSaved?: (patient: Patient) => void;
  onExisting?: (patient: Patient) => void;
}
export default function PatientForm({
  patient,
  onClose,
  onSaved,
  onExisting,
}: Props) {
  const { state, setState, notify } = useClinic();
  const [id] = useState(() => patient?.id || generatePatientId(state.patients));
  const [values, setValues] = useState({
    name: patient?.name || "",
    phone: patient?.phone || "",
    email: patient?.email || "",
    dob: patient?.dob || "",
    gender: patient?.gender || "Prefer not to say",
    address: patient?.address || "",
    emergencyContact: patient?.emergencyContact || "",
    referralSource: patient?.referralSource || "Walk-in",
    assignedDoctor: patient?.assignedDoctor || doctors[0],
    communicationPreference: patient?.communicationPreference || "Phone",
    consentStatus: patient?.consentStatus || "Pending",
    treatment:
      patient?.treatment || state.records["Treatment Catalogue"][0]?.name || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ack, setAck] = useState(false);
  const duplicates = likelyDuplicates(
    state.patients,
    values.phone,
    values.email,
    patient?.id,
  );
  const age = calculateAge(values.dob);
  const change = (key: keyof typeof values, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
    if (key === "phone" || key === "email") setAck(false);
  };
  function validate() {
    const e: Record<string, string> = {};
    if (values.name.trim().length < 2)
      e.name = "Enter the patient’s full name.";
    if (!validPhone(values.phone))
      e.phone =
        "Enter a valid Indian mobile number (10 digits, with optional +91).";
    if (!validEmail(values.email.trim()))
      e.email = "Enter a valid email address, or leave this blank.";
    if (age === null || age > 120)
      e.dob = "Choose a valid date of birth, not in the future (age 0–120).";
    if (values.emergencyContact && !validPhone(values.emergencyContact))
      e.emergencyContact = "Enter a valid mobile number, or leave this blank.";
    if (!values.assignedDoctor) e.assignedDoctor = "Select an assigned doctor.";
    if (values.communicationPreference === "Email" && !values.email.trim())
      e.email =
        "Add an email address for the selected communication preference.";
    if (duplicates.length && !ack)
      e.duplicate =
        "Review the likely matches before creating a separate patient.";
    return e;
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const issues = validate();
    setErrors(issues);
    if (Object.keys(issues).length) {
      notify("Please check the highlighted patient details.", "error");
      return;
    }
    const p: Patient = {
      ...patient,
      ...values,
      id,
      name: values.name.trim(),
      phone: values.phone.trim(),
      email: values.email.trim().toLowerCase(),
      age: age!,
      status: patient?.status || "New",
      lastVisit: patient?.lastVisit || "Not visited",
      registeredAt: patient?.registeredAt || DEMO_DATE,
    };
    setState((s) =>
      addActivity(
        patient ? updatePatient(s, p) : { ...s, patients: [p, ...s.patients] },
        `${p.name}: patient ${patient ? "details updated" : "registered"}.`,
        p.id,
      ),
    );
    notify(
      patient ? "Patient details saved" : "Patient registered successfully",
    );
    onClose();
    onSaved?.(p);
  }
  const field = (
    key: keyof typeof values,
    label: string,
    type = "text",
    required = false,
  ) => (
    <label className={errors[key] ? "field-invalid" : ""}>
      {label}
      {required && <span className="required-marker">*</span>}
      <input
        aria-label={label}
        name={key}
        type={type}
        value={values[key]}
        onChange={(e) => change(key, e.target.value)}
        required={required}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `error-${key}` : undefined}
        max={type === "date" ? DEMO_DATE : undefined}
        autoComplete={
          key === "name"
            ? "name"
            : key === "email"
              ? "email"
              : key === "phone"
                ? "tel"
                : undefined
        }
      />
      {errors[key] && (
        <span className="field-error" id={`error-${key}`}>
          {errors[key]}
        </span>
      )}
    </label>
  );
  return (
    <Modal
      title={patient ? "Edit patient details" : "Register patient"}
      className="patient-form-modal"
      onClose={onClose}
    >
      <div className="patient-form-intro">
        <span className="round-symbol sage-bg">
          <UserRoundPlus size={20} />
        </span>
        <div>
          <strong>
            {patient
              ? "One record. A connected journey."
              : "A thoughtful start to better care."}
          </strong>
          <p>Fictional demo information only. Required fields are marked *.</p>
        </div>
      </div>
      <form onSubmit={submit} noValidate>
        <div className="patient-form-section">
          <h3>Identity & contact</h3>
          <div className="registration-grid">
            <label className="generated-id">
              Patient ID
              <input aria-label="Patient ID" readOnly value={id} />
              <small>
                <CopyCheck size={11} />
                Generated automatically · stays with this patient
              </small>
            </label>
            {field("name", "Full name", "text", true)}
            {field("phone", "Mobile", "tel", true)}
            {field("email", "Email", "email")}
            {field("dob", "Date of birth", "date", true)}
            <label>
              Calculated age
              <input
                aria-label="Calculated age"
                readOnly
                value={age === null ? "Select date of birth" : `${age} years`}
              />
              <small>As of 23 Oct 2026 · clinic demo date</small>
            </label>
            <label>
              Gender
              <select
                value={values.gender}
                onChange={(e) => change("gender", e.target.value)}
              >
                {[
                  "Prefer not to say",
                  "Woman",
                  "Man",
                  "Non-binary",
                  "Self-described",
                ].map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            {field("emergencyContact", "Emergency contact (optional)", "tel")}
            <label className="full-width">
              Address
              <textarea
                name="address"
                value={values.address}
                onChange={(e) => change("address", e.target.value)}
                placeholder="Street, locality, city and postcode"
              />
            </label>
          </div>
        </div>
        {duplicates.length > 0 && (
          <section
            className="duplicate-warning"
            aria-label="Likely duplicate patients"
          >
            <div>
              <AlertCircle size={18} />
              <strong>
                We found{" "}
                {duplicates.length === 1 ? "a likely match" : "likely matches"}.
              </strong>
            </div>
            <p>
              Matching mobile or email. Open the existing record to keep care
              connected.
            </p>
            {duplicates.map((p) => (
              <div className="duplicate-match" key={p.id}>
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {p.id} · {p.phone}
                  </small>
                </span>
                {onExisting && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      onClose();
                      onExisting(p);
                    }}
                  >
                    Open existing <ArrowUpRight size={13} />
                  </button>
                )}
              </div>
            ))}
            <label className="checkbox">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => {
                  setAck(e.target.checked);
                  setErrors((v) => ({ ...v, duplicate: "" }));
                }}
              />
              I reviewed these matches; this is a different person.
            </label>
            {errors.duplicate && (
              <span className="field-error" role="alert">
                {errors.duplicate}
              </span>
            )}
          </section>
        )}
        <div className="patient-form-section">
          <h3>Care preferences</h3>
          <div className="registration-grid">
            <label>
              Assigned doctor <span className="required-marker">*</span>
              <select
                value={values.assignedDoctor}
                onChange={(e) => change("assignedDoctor", e.target.value)}
              >
                {clinicDoctors(state).map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label>
              Treatment interest
              <select
                value={values.treatment}
                onChange={(e) => change("treatment", e.target.value)}
              >
                {[
                  ...new Set([
                    values.treatment,
                    ...state.records["Treatment Catalogue"].map((r) => r.name),
                  ]),
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Referral source
              <select
                value={values.referralSource}
                onChange={(e) => change("referralSource", e.target.value)}
              >
                {[
                  ...new Set([
                    values.referralSource,
                    "Walk-in",
                    "Website",
                    "Instagram",
                    "Google search",
                    "Patient referral",
                    "Doctor referral",
                    "Other",
                  ]),
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Communication preference
              <select
                value={values.communicationPreference}
                onChange={(e) =>
                  change("communicationPreference", e.target.value)
                }
              >
                {["Phone", "WhatsApp", "SMS", "Email", "Do not contact"].map(
                  (s) => (
                    <option key={s}>{s}</option>
                  ),
                )}
              </select>
            </label>
            <label className="full-width">
              Communication consent status
              <select
                value={values.consentStatus}
                onChange={(e) => change("consentStatus", e.target.value)}
              >
                <option>Pending</option>
                <option>Granted</option>
                <option>Declined</option>
              </select>
              <small>
                Contact preference only. Procedure-specific consent is recorded
                separately.
              </small>
            </label>
          </div>
        </div>
        <div className="info-strip">
          <ShieldCheck size={16} />
          No messages will be sent. This demo does not collect a real signature
          or clinical consent.
        </div>
        <div className="form-actions patient-form-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" type="submit">
            {patient ? "Save changes" : "Register patient"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
