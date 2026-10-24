import { clinicDoctors } from "../admin/access";
import { useState, useEffect, type ChangeEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Plus, Search, ArrowUpRight, ImagePlus, Trash2 } from "lucide-react";
import { Badge, Modal } from "../../components";
import { DEMO_DATE, type RecordItem } from "../../data";
import { doctors } from "../../patientServices";
import { canDecide, blankConsultation, type ConsultationData } from "./model";
import { saveConsultation, reviewConsultation } from "./services";
import {
  ClinicalNotice,
  FormSection,
  PatientContext,
  DiscardDialog,
  useClinicalSave,
} from "./ClinicalComponents";
import DecisionFields from "./DecisionFields";
import { readAsset, validateUpload } from "../scans/assets";
import { AssetViewer } from "../scans/ScanComponents";
import type { ScanAsset } from "../scans/model";
import type { Role } from "../../auth";
export function ConsultationForm({
  existing,
  initialPatientId = "",
  onClose,
  onSaved,
  onPatient,
  requestCancelRef,
}: {
  existing?: RecordItem;
  initialPatientId?: string;
  onClose: () => void;
  onSaved: (r: RecordItem) => void;
  onPatient?: (id: string) => void;
  requestCancelRef?: { current: (() => void) | null };
}) {
  const { state, save, error, setError, notify } = useClinicalSave();
  const [id] = useState(
    existing?.id || "CON-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
  );
  const [patientId, setPatient] = useState(
    existing?.patientId || initialPatientId,
  );
  const patient = state.patients.find((p) => p.id === patientId);
  const [doctor, setDoctor] = useState(
    existing?.doctor || patient?.assignedDoctor || doctors[0],
  );
  const [data, setData] = useState<ConsultationData>(() =>
    structuredClone(existing?.consultation || blankConsultation),
  );
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [switchPatient, setSwitch] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ScanAsset | null>(null);
  function update(next: Partial<ConsultationData>) {
    setData((d) => ({ ...d, ...next }));
    setDirty(true);
    setError("");
  }
  function cancel() {
    if (busy) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  useEffect(() => {
    if (requestCancelRef) requestCancelRef.current = cancel;
    return () => {
      if (requestCancelRef) requestCancelRef.current = null;
    };
  });
  function changePatient(id: string) {
    setPatient(id);
    setDoctor(
      state.patients.find((p) => p.id === id)?.assignedDoctor || doctors[0],
    );
    setData(structuredClone(blankConsultation));
    setDirty(false);
    setSwitch("");
  }
  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget,
      files = Array.from(input.files || []);
    const errors = files.map((f) => validateUpload(f, "image")).filter(Boolean);
    if (errors.length) {
      setError(errors.join(" "));
      input.value = "";
      return;
    }
    if (
      files.length + data.images.length > 4 ||
      files.reduce((n, f) => n + f.size, 0) +
        data.images.reduce((n, f) => n + f.size, 0) >
        1500000
    ) {
      setError("Use up to four demo images and 1.5 MB total.");
      input.value = "";
      return;
    }
    setBusy(true);
    try {
      update({
        images: [
          ...data.images,
          ...(await Promise.all(files.map((f) => readAsset(f, "image")))),
        ],
      });
      notify("Demo images attached. No image analysis was performed.");
    } catch {
      setError("Images could not be read. Try again.");
    } finally {
      setBusy(false);
      input.value = "";
    }
  }
  function persist(status: string) {
    try {
      if (data.images.length && !data.imageConsent) {
        setError(
          "Confirm fictional image use and recorded consent before saving attachments.",
        );
        return;
      }
      const r: RecordItem = {
        ...existing,
        id,
        name: patient?.name || "",
        patientId,
        doctor,
        date: existing?.date || DEMO_DATE,
        status,
        amount: 0,
        detail: data.concern.trim() || "Consultation draft",
        consultation: data,
      };
      if (
        save(
          saveConsultation(state, r),
          status === "Draft"
            ? "Consultation draft saved"
            : "Consultation submitted for clinician review",
          patientId,
        )
      )
        onSaved(r);
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <div className="clinical-workspace">
      <div className="clinical-primary">
        <FormSection title="Patient & consultation" kicker="01 / CONTEXT">
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
                  .filter((p) => p.status !== "Archived" || p.id === patientId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} | {p.id}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Assigned doctor
              <select
                aria-label="Consulting doctor"
                value={doctor}
                onChange={(e) => {
                  setDoctor(e.target.value);
                  setDirty(true);
                }}
              >
                {clinicDoctors(state).map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
          </div>
        </FormSection>
        <FormSection title="Presenting concern" kicker="02 / PATIENT ACCOUNT">
          <div className="clinical-fields">
            {[
              ["Presenting concern", "concern"],
              ["Duration of concern", "duration"],
              ["Previous treatments", "previousTreatments"],
              ["Patient expectations", "expectations"],
              ["Previous reactions", "previousReactions"],
            ].map(([label, key]) => (
              <label
                className={key === "concern" ? "clinical-span" : ""}
                key={key}
              >
                {label}
                <textarea
                  aria-label={label}
                  value={data[key as keyof ConsultationData] as string}
                  onChange={(e) => update({ [key]: e.target.value })}
                  placeholder="Enter what the patient reports"
                />
              </label>
            ))}
          </div>
        </FormSection>
        <FormSection
          title="Examination & clinician assessment"
          kicker="03 / CLINICAL RECORD"
        >
          <div className="clinical-fields">
            {[
              ["Examination observations", "examination"],
              ["Clinician assessment", "assessment"],
              ["Considerations", "considerations"],
              ["Required reviews", "requiredReviews"],
            ].map(([label, key]) => (
              <label key={key}>
                {label}
                <textarea
                  aria-label={label}
                  value={data[key as keyof ConsultationData] as string}
                  onChange={(e) => update({ [key]: e.target.value })}
                  placeholder="Clinician-entered; nothing is generated"
                />
              </label>
            ))}
          </div>
          <div className="clinical-image-upload">
            <label>
              <ImagePlus size={16} />
              Upload fictional/demo images
              <input
                aria-label="Consultation images"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                disabled={busy}
                onChange={upload}
              />
            </label>
            <small>
              JPG, PNG, WebP · 650 KB each · 1.5 MB total · original aspect
              ratios retained
            </small>
            <div className="clinical-image-grid">
              {data.images.map((a) => (
                <div key={a.id}>
                  <button type="button" onClick={() => setPreview(a)}>
                    <img src={a.dataUrl} alt={a.name} />
                  </button>
                  <small>{a.name}</small>
                  <button
                    type="button"
                    className="text-button"
                    aria-label={"Remove " + a.name}
                    onClick={() =>
                      update({
                        images: data.images.filter((v) => v.id !== a.id),
                      })
                    }
                  >
                    <Trash2 size={12} />
                    Remove
                  </button>
                </div>
              ))}
            </div>
            {data.images.length > 0 && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={!!data.imageConsent}
                  onChange={(e) => update({ imageConsent: e.target.checked })}
                />
                These images are fictional/demo assets and relevant consent is
                recorded.
              </label>
            )}
          </div>
        </FormSection>
        <FormSection
          title="Proposed treatment decision"
          kicker="04 / CLINICIAN-ENTERED"
        >
          <p className="clinical-footnote">
            Selecting a treatment loads editable clinic defaults. Confirm each
            value for this patient.
          </p>
          <DecisionFields
            value={data.decision}
            onChange={(decision) => update({ decision })}
            treatments={state.records["Treatment Catalogue"]}
          />
        </FormSection>
        {busy && (
          <p className="clinical-notice" role="status">
            Reading original demo images…
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="clinical-save-bar">
          <Badge>{existing?.status || "Unsaved draft"}</Badge>
          <button className="button secondary" onClick={cancel} disabled={busy}>
            Cancel
          </button>
          <button
            className="button secondary"
            onClick={() => persist("Draft")}
            disabled={busy}
          >
            Save Draft
          </button>
          <button
            className="button primary"
            onClick={() => persist("Awaiting Review")}
            disabled={busy}
          >
            Submit for Review/Approval
          </button>
        </div>
      </div>
      <PatientContext
        patient={patient}
        reactions={
          data.previousReactions ||
          state.records.Consultations.find(
            (c) =>
              c.patientId === patientId &&
              c.id !== id &&
              c.consultation?.previousReactions,
          )?.consultation?.previousReactions
        }
        onPatient={onPatient}
      />
      {discard && (
        <DiscardDialog onKeep={() => setDiscard(false)} onDiscard={onClose} />
      )}{" "}
      {switchPatient && (
        <Modal
          title="Change the consultation patient?"
          onClose={() => setSwitch("")}
        >
          <p>
            Unsaved clinical notes and images will be cleared to keep patient
            records separate.
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
      {preview && (
        <AssetViewer asset={preview} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}
export default function Consultations({ role }: { role: Role }) {
  const { consultationId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { state, save, error, setError } = useClinicalSave();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [review, setReview] = useState(false);
  const [doctor, setDoctor] = useState(doctors[0]);
  const [note, setNote] = useState("");
  const [ack, setAck] = useState(false);
  const [preview, setPreview] = useState<ScanAsset | null>(null);
  const existing = state.records.Consultations.find(
    (r) => r.id === consultationId,
  );
  const isNew = consultationId === "new";
  const edit = params.get("edit") === "true";
  if (consultationId) {
    if (!isNew && !existing)
      return (
        <section className="card empty">
          <h1>Consultation not found</h1>
          <button
            className="button secondary"
            onClick={() => navigate("/consultations")}
          >
            Consultations
          </button>
        </section>
      );
    if (
      (isNew || edit) &&
      canDecide(role) &&
      (!existing || existing.status === "Draft")
    )
      return (
        <div>
          <div className="page-heading">
            <div>
              <div className="eyebrow">CLINICAL WORKSPACE</div>
              <h1>
                {isNew ? "New consultation" : "Resume consultation draft"}
              </h1>
              <p>Record the consultation in your own clinical words.</p>
            </div>
          </div>
          <ClinicalNotice />
          <ConsultationForm
            key={existing?.id || params.toString()}
            existing={existing}
            initialPatientId={params.get("patientId") || ""}
            onClose={() =>
              navigate(
                existing ? "/consultations/" + existing.id : "/consultations",
              )
            }
            onSaved={(r) => navigate("/consultations/" + r.id)}
            onPatient={(id) => navigate("/patients/" + id)}
          />
        </div>
      );
    if (isNew)
      return (
        <section className="card empty">
          <h1>Choose a clinician demo role to start a consultation.</h1>
        </section>
      );
    const r = existing!,
      c = r.consultation!,
      patient = state.patients.find((p) => p.id === r.patientId);
    return (
      <div>
        <button
          className="text-button"
          onClick={() => navigate("/consultations")}
        >
          ← Consultations
        </button>
        <div className="page-heading">
          <div>
            <div className="eyebrow">CONSULTATION / {r.id}</div>
            <h1>{patient?.name} · consultation</h1>
            <p>
              {r.date} · {r.doctor}
            </p>
          </div>
          <div className="heading-actions">
            <Badge>{r.status}</Badge>
            {canDecide(role) && r.status === "Draft" && (
              <button
                className="button primary"
                onClick={() => navigate("?edit=true")}
              >
                Resume Draft
              </button>
            )}
            {canDecide(role) && r.status === "Awaiting Review" && (
              <button
                className="button primary"
                onClick={() => setReview(true)}
              >
                Review consultation
              </button>
            )}
            {canDecide(role) && c.assessment && (
              <button
                className="button secondary"
                onClick={() =>
                  navigate(
                    "/treatment-plans/new?patientId=" +
                      r.patientId +
                      "&consultationId=" +
                      r.id,
                  )
                }
              >
                Create treatment plan
              </button>
            )}
          </div>
        </div>
        <ClinicalNotice />
        <div className="clinical-workspace">
          <div className="clinical-primary">
            <FormSection title="Clinical consultation record">
              <dl className="clinical-detail-grid">
                {[
                  ["Presenting concern", c.concern],
                  ["Duration", c.duration],
                  ["Previous treatments", c.previousTreatments],
                  ["Expectations", c.expectations],
                  ["Examination observations", c.examination],
                  ["Clinician assessment", c.assessment],
                  ["Considerations", c.considerations],
                  ["Required reviews", c.requiredReviews],
                  ["Review note", c.reviewNote],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v || "Not recorded"}</dd>
                  </div>
                ))}
              </dl>
              {c.images.length > 0 && (
                <div className="clinical-image-grid">
                  {c.images.map((a) => (
                    <button key={a.id} onClick={() => setPreview(a)}>
                      <img src={a.dataUrl} alt={a.name} />
                    </button>
                  ))}
                </div>
              )}
            </FormSection>
            <FormSection title="Proposed treatment decision">
              <DecisionFields
                disabled
                value={c.decision}
                onChange={() => {}}
                treatments={state.records["Treatment Catalogue"]}
              />
            </FormSection>
          </div>
          <PatientContext
            patient={patient}
            reactions={c.previousReactions}
            onPatient={(id) => navigate("/patients/" + id)}
          />
        </div>
        {review && (
          <Modal
            title="Clinician consultation review"
            onClose={() => setReview(false)}
          >
            <div className="clinical-form">
              <label>
                Reviewing doctor
                <select
                  value={doctor}
                  onChange={(e) => setDoctor(e.target.value)}
                >
                  {clinicDoctors(state).map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label>
                Review note
                <textarea
                  aria-label="Consultation review note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                I have reviewed the clinical record and proposed decision.
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <button
                  className="button secondary"
                  onClick={() => setReview(false)}
                >
                  Cancel
                </button>
                <button
                  className="button primary"
                  onClick={() => {
                    try {
                      if (!ack)
                        throw new Error("Confirm clinician review first.");
                      if (
                        save(
                          reviewConsultation(state, r.id, doctor, note),
                          "Consultation reviewed",
                          r.patientId,
                        )
                      )
                        setReview(false);
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                >
                  Mark Reviewed
                </button>
              </div>
            </div>
          </Modal>
        )}
        {preview && (
          <AssetViewer asset={preview} onClose={() => setPreview(null)} />
        )}
      </div>
    );
  }
  const rows = state.records.Consultations.filter(
    (r) =>
      (r.name + " " + r.id + " " + r.detail)
        .toLowerCase()
        .includes(q.toLowerCase()) &&
      (status === "All" || r.status === status),
  );
  return (
    <div>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CLINICIAN-LED CARE</div>
          <h1>Consultations</h1>
          <p>From patient concern to a reviewed clinical decision.</p>
        </div>
        {canDecide(role) && (
          <button
            className="button primary"
            onClick={() => navigate("/consultations/new")}
          >
            <Plus size={15} />
            New consultation
          </button>
        )}
      </div>
      <ClinicalNotice />
      <div className="card clinical-toolbar">
        <div className="search-field">
          <Search size={15} />
          <input
            aria-label="Search consultations"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Patient, consultation ID or concern…"
          />
        </div>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {["All", "Draft", "Awaiting Review", "Reviewed"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <button
          className="text-button"
          onClick={() => {
            setQ("");
            setStatus("All");
          }}
        >
          Reset
        </button>
      </div>
      <div className="card clinical-record-list">
        {rows.map((r) => (
          <article key={r.id}>
            <button
              className="clinical-list-patient"
              onClick={() => navigate("/patients/" + r.patientId)}
            >
              <strong>{r.name}</strong>
              <small>{r.patientId}</small>
            </button>
            <div>
              <strong>{r.detail}</strong>
              <small>
                {r.date} · {r.doctor || "Doctor unassigned"} · {r.id}
              </small>
            </div>
            <Badge>{r.status}</Badge>
            <button
              className="button secondary"
              onClick={() =>
                navigate(
                  "/consultations/" +
                    r.id +
                    (r.status === "Draft" ? "?edit=true" : ""),
                )
              }
            >
              {r.status === "Draft" ? "Resume Draft" : "Open consultation"}
              <ArrowUpRight size={13} />
            </button>
          </article>
        ))}
        {!rows.length && (
          <div className="empty">
            <h3>No consultations in this view</h3>
            <p>Start a consultation or adjust your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
