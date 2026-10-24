import { clinicTechnicians } from "../admin/access";
import { clinicDoctors } from "../admin/access";
import { useState, useEffect } from "react";
import { DEMO_DATE, money, type RecordItem } from "../../data";
import { doctors } from "../../patientServices";
import { Badge, Modal } from "../../components";
import { type PlanData, technicians, estimate } from "./model";
import { savePlan } from "./services";
import {
  FormSection,
  PatientContext,
  DiscardDialog,
  useClinicalSave,
} from "./ClinicalComponents";
function defaults(t?: RecordItem) {
  return {
    treatmentId: t?.id || "",
    treatmentName: t?.name || "",
    sessions: t?.treatment?.sessions || 1,
    intervalDays: t?.treatment?.intervalDays || 28,
    duration: t?.treatment?.duration || 30,
    individualPrice: t?.treatment?.individualPrice || 0,
    packagePrice: t?.treatment?.packagePrice || 0,
    packageSessions: t?.treatment?.sessions || 1,
    validityDays: t?.treatment?.validityDays || 180,
    consent: t?.treatment?.consent || "",
  };
}
export default function PlanBuilder({
  existing,
  initialPatientId = "",
  initialConsultationId = "",
  onClose,
  onSaved,
  onPatient,
  requestCancelRef,
}: {
  existing?: RecordItem;
  initialPatientId?: string;
  initialConsultationId?: string;
  onClose: () => void;
  onSaved: (r: RecordItem) => void;
  onPatient?: (id: string) => void;
  requestCancelRef?: { current: (() => void) | null };
}) {
  const { state, save, error, setError } = useClinicalSave();
  const [id] = useState(
    existing?.id || "PLAN-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
  );
  const initialConsult = state.records.Consultations.find(
    (c) => c.id === initialConsultationId,
  );
  const [patientId, setPatient] = useState(
    existing?.patientId || initialPatientId || initialConsult?.patientId || "",
  );
  const patient = state.patients.find((p) => p.id === patientId);
  const [p, setPlan] = useState<PlanData>(() => {
    if (existing?.plan) return structuredClone(existing.plan);
    const c = initialConsult?.consultation;
    const t = state.records["Treatment Catalogue"].find(
      (t) => t.id === c?.decision.treatmentId,
    );
    return {
      ...defaults(t),
      consultationId: initialConsult?.id || "",
      area: c?.decision.area || "",
      doctor: patient?.assignedDoctor || doctors[0],
      technician: technicians[0],
      pricing: "package",
      instructions: c?.decision.instructions || "",
      assessment: c?.assessment || "",
      notes: "",
      ...(c
        ? {
            sessions: c.decision.sessions,
            intervalDays: c.decision.intervalDays,
            duration: c.decision.duration,
          }
        : {}),
    };
  });
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [switchPatient, setSwitch] = useState("");
  const consultations = state.records.Consultations.filter(
    (c) => c.patientId === patientId,
  );
  const source = consultations.find((c) => c.id === p.consultationId);
  function update(next: Partial<PlanData>) {
    setPlan((p) => ({ ...p, ...next }));
    setDirty(true);
    setError("");
  }
  function close() {
    if (dirty) setDiscard(true);
    else onClose();
  }
  useEffect(() => {
    if (requestCancelRef) requestCancelRef.current = close;
    return () => {
      if (requestCancelRef) requestCancelRef.current = null;
    };
  });
  function changePatient(id: string) {
    setPatient(id);
    setPlan({
      ...p,
      ...defaults(),
      consultationId: "",
      area: "",
      assessment: "",
      notes: "",
      instructions: "",
      doctor:
        state.patients.find((p) => p.id === id)?.assignedDoctor || doctors[0],
    });
    setDirty(false);
    setSwitch("");
  }
  function submit(status: string) {
    const record: RecordItem = {
      ...existing,
      id,
      patientId,
      name: patient?.name || "",
      date: existing?.date || DEMO_DATE,
      status,
      amount: Number.isFinite(estimate(p)) ? estimate(p) : 0,
      detail:
        (p.treatmentName || "Treatment plan draft") +
        " | " +
        (p.area || "area pending"),
      plan: {
        ...p,
        approvedAt: undefined,
        approvedBy: undefined,
        declineReason: undefined,
      },
    };
    try {
      if (
        save(
          savePlan(state, record),
          status === "Draft"
            ? "Treatment plan draft saved"
            : "Treatment plan submitted for approval",
          patientId,
        )
      )
        onSaved(record);
    } catch (err) {
      setError((err as Error).message);
    }
  }
  const total = estimate(p);
  return (
    <div className="clinical-workspace">
      <div className="clinical-primary">
        <FormSection
          title="Patient & source assessment"
          kicker="01 / CONNECTED CLINICAL CONTEXT"
        >
          <div className="clinical-fields">
            <label>
              Patient
              <select
                aria-label="Patient"
                value={patientId}
                disabled={!!initialPatientId || !!existing}
                onChange={(e) =>
                  dirty
                    ? setSwitch(e.target.value)
                    : changePatient(e.target.value)
                }
              >
                <option value="">Select existing patient</option>
                {state.patients
                  .filter((v) => v.status !== "Archived" || v.id === patientId)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} | {v.id}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Source consultation
              <select
                aria-label="Source consultation"
                value={p.consultationId}
                onChange={(e) => {
                  const c = consultations.find((c) => c.id === e.target.value);
                  const d = c?.consultation?.decision;
                  const t = state.records["Treatment Catalogue"].find(
                    (t) => t.id === d?.treatmentId,
                  );
                  update({
                    ...defaults(t),
                    consultationId: c?.id || "",
                    assessment: c?.consultation?.assessment || "",
                    area: d?.area || "",
                    instructions: d?.instructions || "",
                    ...(d
                      ? {
                          sessions: d.sessions,
                          intervalDays: d.intervalDays,
                          duration: d.duration,
                        }
                      : {}),
                  });
                }}
              >
                <option value="">Select this patient's consultation</option>
                {consultations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.date} | {c.status} | {c.id}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="clinical-assessment">
            <small>CLINICIAN-ENTERED ASSESSMENT</small>
            <p>
              {p.assessment ||
                "No source assessment selected. A reviewed assessment is required before approval."}
            </p>
            {source && (
              <>
                <Badge>{source.status}</Badge>
                <p className="clinical-footnote">
                  Consultation proposed price:{" "}
                  {money(source.consultation?.decision.price || 0)}. The plan
                  estimate below uses the displayed configuration.
                </p>
              </>
            )}
          </div>
        </FormSection>
        <FormSection
          title="Treatment configuration"
          kicker="02 / CLINICIAN PROPOSAL"
        >
          <p className="clinical-footnote">
            Defaults are adjustable clinic configuration. Confirm suitability
            and schedule for this patient.
          </p>
          <div className="clinical-fields">
            <label>
              Treatment
              <select
                aria-label="Treatment"
                value={p.treatmentId}
                onChange={(e) =>
                  update(
                    defaults(
                      state.records["Treatment Catalogue"].find(
                        (t) => t.id === e.target.value,
                      ),
                    ),
                  )
                }
              >
                <option value="">Select treatment</option>
                {state.records["Treatment Catalogue"]
                  .filter(
                    (t) => t.status === "Active" || t.id === p.treatmentId,
                  )
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.status !== "Active" ? " (inactive)" : ""}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Treatment area
              <input
                aria-label="Plan treatment area"
                value={p.area}
                onChange={(e) => update({ area: e.target.value })}
              />
            </label>
            {[
              ["Clinician-approved sessions", "sessions", 100],
              ["Interval (days)", "intervalDays", 3650],
              ["Duration per session (minutes)", "duration", 600],
              ["Package validity (days)", "validityDays", 3650],
            ].map(([label, key, max]) => (
              <label key={key}>
                {label}
                <input
                  aria-label={String(label)}
                  type="number"
                  min="1"
                  max={Number(max)}
                  step="1"
                  value={p[key as keyof PlanData] as number}
                  onChange={(e) => update({ [key]: Number(e.target.value) })}
                />
              </label>
            ))}
            <label>
              Assigned doctor
              <select
                aria-label="Plan doctor"
                value={p.doctor}
                onChange={(e) => update({ doctor: e.target.value })}
              >
                {clinicDoctors(state).map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label>
              Assigned technician
              <select
                aria-label="Plan technician"
                value={p.technician}
                onChange={(e) => update({ technician: e.target.value })}
              >
                {clinicTechnicians(state).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
        </FormSection>
        <FormSection
          title="Estimate & package option"
          kicker="03 / TRANSPARENT INR PRICING"
        >
          <div className="clinical-fields">
            <label>
              Package option
              <select
                aria-label="Package option"
                value={p.pricing}
                onChange={(e) =>
                  update({ pricing: e.target.value as PlanData["pricing"] })
                }
              >
                <option value="package">Clinic package rate</option>
                <option value="individual">Individual session rate</option>
              </select>
            </label>
            <label>
              Individual session price (INR)
              <input
                aria-label="Individual session price (INR)"
                type="number"
                min="0"
                step="1"
                value={p.individualPrice}
                onChange={(e) =>
                  update({ individualPrice: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Reference package price (INR)
              <input
                aria-label="Reference package price (INR)"
                type="number"
                min="0"
                step="1"
                value={p.packagePrice}
                onChange={(e) =>
                  update({ packagePrice: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Reference package sessions
              <input
                aria-label="Reference package sessions"
                type="number"
                min="1"
                max="100"
                value={p.packageSessions}
                onChange={(e) =>
                  update({ packageSessions: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <div className="clinical-estimate">
            <div>
              <small>PROPOSED TOTAL · INR</small>
              <strong>
                {Number.isFinite(total) ? money(total) : "Check configuration"}
              </strong>
            </div>
            <p>
              {p.pricing === "package"
                ? `${money(p.packagePrice)} ÷ ${p.packageSessions} reference sessions × ${p.sessions} approved sessions`
                : `${money(p.individualPrice)} per session × ${p.sessions} approved sessions`}
              <small>
                Rounded to the nearest rupee. Demo quote; no payment has been
                collected. Catalogue updates do not change this saved price
                snapshot.
              </small>
            </p>
          </div>
        </FormSection>
        <FormSection
          title="Instructions & approval note"
          kicker="04 / CLINICIAN CONFIRMATION"
        >
          <div className="clinical-fields">
            <label>
              Instructions
              <textarea
                aria-label="Plan instructions"
                value={p.instructions}
                onChange={(e) => update({ instructions: e.target.value })}
              />
            </label>
            <label>
              Consent requirements
              <textarea
                aria-label="Plan consent requirements"
                value={p.consent}
                onChange={(e) => update({ consent: e.target.value })}
              />
            </label>
            <label className="clinical-span">
              Clinician plan note
              <textarea
                aria-label="Clinician plan note"
                value={p.notes}
                onChange={(e) => update({ notes: e.target.value })}
                placeholder="Record the agreed goals and considerations. Nothing is generated."
              />
            </label>
          </div>
        </FormSection>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="clinical-save-bar">
          <Badge>{existing?.status || "Unsaved draft"}</Badge>
          <button className="button secondary" onClick={close}>
            Cancel
          </button>
          <button className="button secondary" onClick={() => submit("Draft")}>
            Save Draft
          </button>
          <button
            className="button primary"
            onClick={() => submit("Awaiting Approval")}
          >
            Submit for Approval
          </button>
        </div>
      </div>
      <PatientContext
        patient={patient}
        reactions={source?.consultation?.previousReactions}
        onPatient={onPatient}
      />
      {discard && (
        <DiscardDialog onKeep={() => setDiscard(false)} onDiscard={onClose} />
      )}{" "}
      {switchPatient && (
        <Modal title="Change the plan patient?" onClose={() => setSwitch("")}>
          <p>
            Clear the unsaved proposal and source assessment before selecting
            another patient?
          </p>
          <div className="form-actions">
            <button className="button secondary" onClick={() => setSwitch("")}>
              Keep patient
            </button>
            <button
              className="button danger"
              onClick={() => changePatient(switchPatient)}
            >
              Change patient
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
