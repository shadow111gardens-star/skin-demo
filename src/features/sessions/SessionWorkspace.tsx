import { clinicDoctors, clinicTechnicians } from "../admin/access";
import { machineRestriction, machineStatus } from "../operations/selectors";
import { SessionInventory } from "../operations/StockAdjustment";
import { useState, useEffect, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Save,
  ArrowUpRight,
  Trash2,
  ImagePlus,
  AlertTriangle,
} from "lucide-react";
import { useClinic } from "../../store";
import { Badge } from "../../components";
import { type RecordItem, type ClinicState } from "../../data";
import { canClinical, canBook, type Role } from "../../auth";
import { FormSection, DiscardDialog } from "../clinical/ClinicalComponents";
import { AssetViewer } from "../scans/ScanComponents";
import { readAsset, validateUpload } from "../scans/assets";
import type { ScanAsset } from "../scans/model";
import {
  clinicalActor,
  defaultPolicy,
  type SessionData,
  type SessionStatus,
} from "./model";
import {
  saveSessionDraft,
  transitionSession,
  rescheduleSession,
  allowedTransitions,
  packageBalance,
  bookLinked,
  suggestedNextDate,
} from "./services";
import ConfigurationDialog from "./ConfigurationDialog";
import SessionContext from "./SessionContext";
import ParameterPanel from "./ParameterPanel";
import SessionDialogs from "./SessionDialogs";
export default function SessionWorkspace({ role }: { role: Role }) {
  const { sessionId } = useParams();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [sessionId]);
  const { state } = useClinic();
  const navigate = useNavigate();
  const r = state.records["Sittings & Sessions"].find(
    (r) => r.id === sessionId || r.appointmentId === sessionId,
  );
  if (!r?.session)
    return (
      <section className="card empty">
        <h1>Session not found</h1>
        <p>This record is not available in the local clinic workspace.</p>
        <button
          className="button primary"
          onClick={() => navigate("/sittings-sessions")}
        >
          Session queue
        </button>
      </section>
    );
  return <SessionEditor key={r.id} record={r} role={role} />;
}
function SessionEditor({
  record: r,
  role,
}: {
  record: RecordItem;
  role: Role;
}) {
  const { state, setState, notify } = useClinic();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<SessionData>(() =>
    structuredClone(r.session!),
  );
  const [dirty, setDirty] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [config, setConfig] = useState(false);
  const [preview, setPreview] = useState<ScanAsset | null>(null);
  const [discard, setDiscard] = useState(false);
  const [pendingPath, setPendingPath] = useState("");
  const terminal = ["Completed", "Cancelled", "No-show"].includes(r.status),
    readOnly = terminal || !canClinical(role);
  const course = state.records["Treatment Plans"].find(
      (c) => c.id === r.courseId,
    ),
    appointment = state.appointments.find((a) => a.id === r.appointmentId),
    balance = packageBalance(state, r);
  const previous = state.records["Sittings & Sessions"]
    .filter(
      (v) =>
        v.id !== r.id &&
        v.patientId === r.patientId &&
        v.status === "Completed" &&
        (r.courseId ? v.courseId === r.courseId : true) &&
        ((v.session?.number || 0) < draft.number ||
          (v.date || "") < (r.date || "")),
    )
    .sort(
      (a, b) =>
        (b.date || "").localeCompare(a.date || "") ||
        (b.session?.number || 0) - (a.session?.number || 0),
    )[0];
  const actor = {
    role,
    name: clinicalActor(role)
      ? draft.reviewingDoctor || "Clinic clinician"
      : draft.operator || "Clinic operator",
  };
  const steps = [
    "Preparation",
    "Device & parameters",
    "Procedure record",
    "Review & next steps",
  ];
  function update(data: Partial<SessionData>) {
    setDraft((d) => ({ ...d, ...data }));
    setDirty(true);
    setError("");
  }
  function go(path: string) {
    if (dirty) {
      setPendingPath(path);
      setDiscard(true);
    } else navigate(path);
  }
  function commit(next: ClinicState, message: string, preserveDraft = false) {
    try {
      localStorage.setItem("mmverse-v1", JSON.stringify(next));
      setState(next);
      if (!preserveDraft) {
        setDraft(
          structuredClone(
            next.records["Sittings & Sessions"].find((v) => v.id === r.id)!
              .session!,
          ),
        );
        setDirty(false);
      }
      setError("");
      notify(message);
      return true;
    } catch {
      setError(
        "Changes could not be saved. Free browser storage and try again.",
      );
      notify("Session changes were not saved.", "error");
      return false;
    }
  }
  function save() {
    try {
      return commit(
        saveSessionDraft(state, r.id, draft, actor.name),
        "Session draft saved; package balance unchanged",
      );
    } catch (err) {
      setError((err as Error).message);
      notify("Session draft was not saved.", "error");
      return false;
    }
  }
  function openDialog(action: string) {
    setDialog(action);
    setReason("");
    setConfirm(false);
    setDate(draft.nextDate || "");
    setTime("09:00");
    setError("");
  }
  function act() {
    try {
      let base =
        terminal || !canClinical(role)
          ? state
          : saveSessionDraft(state, r.id, draft, actor.name);
      if (dialog === "reschedule") {
        if (!confirm)
          throw new Error("Confirm rescheduling without a package deduction.");
        base = rescheduleSession(base, r.id, date, time, reason, actor.name);
      } else if (dialog === "sitting" || dialog === "followup") {
        const result = bookLinked(
          base,
          r.id,
          dialog,
          date,
          time,
          reason,
          actor.name,
        );
        if (
          commit(
            result.state,
            dialog === "sitting"
              ? "Next sitting booked; no parameters were copied"
              : "Follow-up saved to the shared queue",
          )
        ) {
          setDialog("");
          if (dialog === "sitting")
            navigate("/sittings-sessions/" + result.recordId);
        }
        return;
      } else {
        if (["Completed", "Cancelled", "No-show"].includes(dialog) && !confirm)
          throw new Error("Confirm this status change first.");
        if (!(
          dialog === "Awaiting Review" &&
          base.records["Sittings & Sessions"].find((v) => v.id === r.id)
            ?.status === "Awaiting Review"
        ))
          base = transitionSession(
            base,
            r.id,
            dialog as SessionStatus,
            actor,
            reason,
          );
      }
      if (
        commit(
          base,
          dialog === "Completed"
            ? "Sitting completed once; shared course and package balance updated"
            : dialog === "reschedule"
              ? "Sitting rescheduled; package balance unchanged"
              : "Session status updated",
        )
      )
        setDialog("");
    } catch (err) {
      setError((err as Error).message);
      notify("The action needs review before it can be saved.", "error");
    }
  }
  async function upload(
    e: ChangeEvent<HTMLInputElement>,
    which: "beforeImages" | "afterImages",
  ) {
    const input = e.currentTarget,
      files = Array.from(input.files || []),
      invalid = files.map((f) => validateUpload(f, "image")).filter(Boolean);
    if (invalid.length) {
      setError(invalid.join(" "));
      input.value = "";
      return;
    }
    const all = [...draft.beforeImages, ...draft.afterImages];
    if (
      all.length + files.length > 8 ||
      all.reduce((n, a) => n + a.size, 0) +
        files.reduce((n, f) => n + f.size, 0) >
        2000000
    ) {
      setError("Use up to 8 demo images and 2 MB total.");
      input.value = "";
      return;
    }
    setBusy(true);
    try {
      update({
        [which]: [
          ...draft[which],
          ...(await Promise.all(files.map((f) => readAsset(f, "image")))),
        ],
      });
    } catch {
      setError("Image files could not be read. Please try again.");
    } finally {
      input.value = "";
      setBusy(false);
    }
  }
  const transitions = allowedTransitions(r.status).filter((t) =>
    t === "Completed"
      ? clinicalActor(role)
      : canClinical(role) ||
        (["Checked In", "Cancelled", "No-show"].includes(t) && canBook(role)),
  );
  const policy = { ...defaultPolicy, ...state.sessionPolicy };
  return (
    <div className="session-workspace">
      <button
        className="text-button session-back"
        onClick={() => go("/sittings-sessions")}
      >
        <ArrowLeft size={13} />
        Session queue
      </button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SESSION RECORD / {r.id}</div>
          <h1>{appointment?.treatment || r.detail.split(" | ")[0]}</h1>
          <p>
            {r.name} · sitting {draft.number} · {r.date} at {draft.time} IST
          </p>
        </div>
        <div className="heading-actions">
          <Badge>{r.status}</Badge>
          {[
            "Scheduled",
            "Checked In",
            "In Preparation",
            "No-show",
            "Cancelled",
          ].includes(r.status) &&
            !draft.startedAt &&
            canBook(role) && (
              <button
                className="button secondary"
                onClick={() => openDialog("reschedule")}
              >
                Reschedule
              </button>
            )}
        </div>
      </div>
      <div className="session-demo-note">
        Fictional clinical documentation · no device connection, generated
        diagnosis, automatic settings or treatment prescription.
      </div>
      <div className="session-metric-strip">
        <span>
          <strong>{draft.number}</strong>Sitting
        </span>
        <span>
          <strong>{balance?.remaining ?? "—"}</strong>Package remaining
        </span>
        <span>
          <strong>{draft.consentStatus}</strong>Consent
        </span>
        <span className={dirty ? "unsaved" : ""}>
          <strong>{dirty ? "Unsaved changes" : "Saved"}</strong>
          {r.session?.savedAt
            ? new Date(r.session.savedAt).toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
              }) + " IST"
            : "Retained source record"}
        </span>
      </div>
      {draft.reaction === "Observed" && (
        <div className="session-warning prominent" role="alert">
          <AlertTriangle size={19} />
          <div>
            <strong>
              Adverse reaction — clinician review and escalation required
            </strong>
            <p>
              Document what was observed and whom you contacted. Save to add it
              to the clinician follow-up queue. No diagnosis or management
              advice is generated.
            </p>
          </div>
        </div>
      )}
      <div className="session-workspace-grid">
        <div className="session-primary">
          <nav className="session-stepper" aria-label="Recording steps">
            {steps.map((s, i) => (
              <button
                key={s}
                aria-current={step === i ? "step" : undefined}
                onClick={() => setStep(i)}
              >
                <span>{i < step ? <Check size={13} /> : i + 1}</span>
                <strong>{s}</strong>
              </button>
            ))}
          </nav>
          {step === 0 && (
            <>
              <FormSection
                title="Session details"
                kicker="01 / PATIENT & OPERATIONAL CONTEXT"
              >
                <div className="clinical-fields">
                  <label>
                    Patient ID
                    <input readOnly value={r.patientId} />
                  </label>
                  <label>
                    Session number
                    <input readOnly value={draft.number} />
                  </label>
                  <label>
                    Session date
                    <input type="date" readOnly value={r.date} />
                  </label>
                  <label>
                    Time (IST)
                    <input type="time" readOnly value={draft.time} />
                  </label>
                  <label>
                    Treatment area
                    <input
                      aria-label="Session treatment area"
                      disabled={readOnly}
                      value={draft.area}
                      onChange={(e) =>
                        update({
                          area: e.target.value,
                          checks: { ...draft.checks, parameters: false },
                          parameterApprovedAt: undefined,
                        })
                      }
                    />
                  </label>
                  <label>
                    Machine
                    <select
                      aria-label="Session machine"
                      value={draft.machineId}
                      disabled={readOnly}
                      onChange={(e) =>
                        update({
                          machineId: e.target.value,
                          parameters: {},
                          parameterSchema: [],
                          handpiece: "",
                          checks: {
                            ...draft.checks,
                            machine: false,
                            parameters: false,
                          },
                          parameterApprovalBy: "",
                          parameterApprovalNote: "",
                          parameterApprovedAt: undefined,
                        })
                      }
                    >
                      <option value="">No machine required</option>
                      {state.records["Machines & Equipment"].map((m) => (
                        <option
                          key={m.id}
                          value={m.id}
                          disabled={!!machineRestriction(state, m.id)}
                        >
                          {m.name} · {machineStatus(state, m)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Handpiece / applicator
                    <input
                      aria-label="Handpiece"
                      disabled={readOnly}
                      value={draft.handpiece}
                      onChange={(e) =>
                        update({
                          handpiece: e.target.value,
                          checks: { ...draft.checks, parameters: false },
                          parameterApprovedAt: undefined,
                        })
                      }
                      placeholder="Operator-entered device reference"
                    />
                  </label>
                  <label>
                    Operator / technician
                    <select
                      aria-label="Session operator"
                      disabled={readOnly}
                      value={draft.operator}
                      onChange={(e) => update({ operator: e.target.value })}
                    >
                      <option value="">Select technician</option>
                      {[
                        ...new Set(
                          [
                            ...clinicTechnicians(state).filter((t) => t !== "Not assigned"),
                            draft.operator,
                          ].filter(Boolean),
                        ),
                      ].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Reviewing doctor
                    <select
                      aria-label="Session reviewing doctor"
                      disabled={readOnly}
                      value={draft.reviewingDoctor}
                      onChange={(e) =>
                        update({ reviewingDoctor: e.target.value })
                      }
                    >
                      <option value="">Select doctor</option>
                      {clinicDoctors(state).map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Room
                    <select
                      aria-label="Session room"
                      disabled={readOnly}
                      value={draft.room}
                      onChange={(e) => update({ room: e.target.value })}
                    >
                      <option value="">Select room</option>
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
                </div>
              </FormSection>
              <FormSection
                title="Clinic checks & required consent"
                kicker="02 / REVIEW BEFORE STARTING"
              >
                <div className="session-safety-checks">
                  <label className="session-checkbox">
                    <input
                      type="checkbox"
                      disabled={readOnly}
                      checked={draft.checks.identity}
                      onChange={(e) =>
                        update({
                          checks: {
                            ...draft.checks,
                            identity: e.target.checked,
                          },
                        })
                      }
                    />
                    Patient identity and linked appointment confirmed *
                  </label>
                  <label className="session-checkbox">
                    <input
                      type="checkbox"
                      disabled={readOnly}
                      checked={draft.checks.history}
                      onChange={(e) =>
                        update({
                          checks: {
                            ...draft.checks,
                            history: e.target.checked,
                          },
                        })
                      }
                    />
                    Clinician-reviewed alerts, allergies, history and previous
                    reactions reviewed {policy.requireHistoryReview ? "*" : ""}
                  </label>
                  {draft.machineId && (
                    <label className="session-checkbox">
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={draft.checks.machine}
                        onChange={(e) =>
                          update({
                            checks: {
                              ...draft.checks,
                              machine: e.target.checked,
                            },
                          })
                        }
                      />
                      Selected machine and treatment room confirmed ready{" "}
                      {policy.requireMachineCheck ? "*" : ""}
                    </label>
                  )}
                </div>
                <div className="clinical-fields">
                  <label>
                    Consent status
                    <select
                      aria-label="Session consent status"
                      disabled={readOnly}
                      value={draft.consentStatus}
                      onChange={(e) =>
                        update({
                          consentStatus: e.target
                            .value as SessionData["consentStatus"],
                        })
                      }
                    >
                      {["Pending", "Recorded", "Declined"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Linked consent document
                    <select
                      aria-label="Session consent document"
                      disabled={readOnly}
                      value={draft.consentDocumentId}
                      onChange={(e) =>
                        update({ consentDocumentId: e.target.value })
                      }
                    >
                      <option value="">Select existing recorded consent</option>
                      {state.records["Clinical Documents"]
                        .filter(
                          (v) =>
                            v.patientId === r.patientId &&
                            (!v.courseId || v.courseId === r.courseId) &&
                            ["Signed", "Recorded"].includes(v.status),
                        )
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.detail} | {v.status}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                <p className="clinical-footnote">
                  {course?.course?.consent ||
                    "Record relevant treatment-specific consent."}{" "}
                  No real signature is collected in this demo.
                </p>
                {!readOnly && (
                  <button
                    className="button secondary"
                    onClick={() => openDialog("consent")}
                  >
                    Record fictional consent
                  </button>
                )}
              </FormSection>
            </>
          )}
          {step === 1 && (
            <FormSection
              title="Machine parameters / approved protocol"
              kicker="03 / ENTERED VALUES ONLY"
            >
              <ParameterPanel
                state={state}
                draft={draft}
                update={update}
                role={role}
                readOnly={readOnly}
                onConfigure={() => setConfig(true)}
              />
              {previous && (
                <button
                  className="text-button session-compare-button"
                  onClick={() => setDialog("compare")}
                >
                  Compare previous documentation
                  <ArrowUpRight size={13} />
                </button>
              )}
            </FormSection>
          )}
          {step === 2 && (
            <>
              <FormSection
                title="Procedure documentation"
                kicker="04 / OBSERVATIONS, NOT AUTOMATED INTERPRETATION"
              >
                <div className="clinical-fields">
                  {[
                    ["Procedure notes", "procedureNotes"],
                    ["Consumables used", "consumables"],
                    ["Patient tolerance", "tolerance"],
                    ["Observed response", "response"],
                    ["Aftercare instructions", "aftercare"],
                    ["Technician notes", "technicianNotes"],
                  ].map(([label, key]) => (
                    <label key={key}>
                      {label}
                      <textarea
                        aria-label={label}
                        disabled={readOnly}
                        value={draft[key as keyof SessionData] as string}
                        onChange={(e) => update({ [key]: e.target.value })}
                        placeholder="Clinician / operator-entered documentation"
                      />
                    </label>
                  ))}
                  <label>
                    Adverse reaction assessment
                    <select
                      aria-label="Adverse reaction assessment"
                      disabled={readOnly}
                      value={draft.reaction}
                      onChange={(e) =>
                        update({
                          reaction: e.target.value as SessionData["reaction"],
                        })
                      }
                    >
                      <option>Not assessed</option>
                      <option>None observed</option>
                      <option>Observed</option>
                    </select>
                  </label>
                  {draft.reaction === "Observed" && (
                    <>
                      <label>
                        Observed adverse reaction
                        <textarea
                          aria-label="Adverse reaction details"
                          disabled={readOnly}
                          value={draft.reactionNotes}
                          onChange={(e) =>
                            update({ reactionNotes: e.target.value })
                          }
                        />
                      </label>
                      <label className="clinical-span">
                        Escalation to reviewing clinician
                        <textarea
                          aria-label="Clinician escalation note"
                          disabled={readOnly}
                          value={draft.escalationNote}
                          onChange={(e) =>
                            update({ escalationNote: e.target.value })
                          }
                          placeholder="Record the clinician contacted, time and documented response. No management advice is generated."
                        />
                      </label>
                    </>
                  )}
                </div>
              </FormSection>
              {canClinical(role) && <SessionInventory sessionId={r.id} />}
              <FormSection
                title="Before & after documentation"
                kicker="05 / ORIGINAL DEMO IMAGES"
              >
                <p className="clinical-footnote">
                  Original frames are preserved. Fictional/demo files only;
                  JPG/PNG/WebP, 650 KB each, 8 files and 2 MB total.
                </p>
                <div className="session-upload-columns">
                  {(["beforeImages", "afterImages"] as const).map((key, i) => (
                    <div key={key}>
                      <label className="session-upload-label">
                        <ImagePlus size={17} />
                        {i ? "After images" : "Before images"}
                        {!readOnly && (
                          <input
                            aria-label={
                              i ? "Upload after images" : "Upload before images"
                            }
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            multiple
                            disabled={busy}
                            onChange={(e) => void upload(e, key)}
                          />
                        )}
                      </label>
                      <div className="session-image-list">
                        {draft[key].map((a) => (
                          <article key={a.id}>
                            <button onClick={() => setPreview(a)}>
                              <img src={a.dataUrl} alt={a.name} />
                            </button>
                            <small>{a.name}</small>
                            {!readOnly && (
                              <button
                                className="text-button"
                                aria-label={"Remove " + a.name}
                                onClick={() =>
                                  update({
                                    [key]: draft[key].filter(
                                      (v) => v.id !== a.id,
                                    ),
                                  })
                                }
                              >
                                <Trash2 size={11} />
                                Remove
                              </button>
                            )}
                          </article>
                        ))}
                        {!draft[key].length && (
                          <p>No {i ? "after" : "before"} images recorded.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {(draft.beforeImages.length > 0 ||
                  draft.afterImages.length > 0) && (
                  <label className="session-checkbox">
                    <input
                      type="checkbox"
                      disabled={readOnly}
                      checked={draft.imageConsent}
                      onChange={(e) =>
                        update({ imageConsent: e.target.checked })
                      }
                    />
                    These are fictional/demo images and relevant image consent
                    is recorded.
                  </label>
                )}
              </FormSection>
            </>
          )}
          {step === 3 && (
            <>
              <FormSection
                title="Doctor review & next steps"
                kicker="06 / CLINICIAN-ENTERED REVIEW"
              >
                <label className="session-review-label">
                  Doctor review
                  <textarea
                    aria-label="Session doctor review"
                    disabled={terminal || !clinicalActor(role)}
                    value={draft.doctorReview}
                    onChange={(e) => update({ doctorReview: e.target.value })}
                    placeholder="Review the record, response, reaction assessment and documented settings. Nothing is generated."
                  />
                </label>
                {!clinicalActor(role) && (
                  <p className="clinical-footnote">
                    A Doctor or Clinic Owner records the review and confirms
                    completion. Demo roles customize this interface only.
                  </p>
                )}
                <label className="session-review-label">
                  Recommended next date
                  <input
                    aria-label="Recommended next date"
                    type="date"
                    min={r.date}
                    disabled={readOnly}
                    value={draft.nextDate}
                    onChange={(e) => update({ nextDate: e.target.value })}
                  />
                </label>
                {suggestedNextDate(state, r) && (
                  <p className="clinical-footnote">
                    The approved course interval points to{" "}
                    {suggestedNextDate(state, r)}. Confirm and enter a date; no
                    appointment or setting is created automatically.
                  </p>
                )}
                <div className="form-actions">
                  <button
                    className="button secondary"
                    disabled={
                      !canBook(role) ||
                      r.status !== "Completed" ||
                      !balance?.remaining
                    }
                    onClick={() => openDialog("sitting")}
                  >
                    Schedule Next Sitting
                  </button>
                  {canBook(role) && (
                    <button
                      className="button secondary"
                      onClick={() => openDialog("followup")}
                    >
                      Book Follow-up
                    </button>
                  )}
                </div>
                <p className="clinical-footnote">
                  A qualifying sitting consumes one package unit after clinician
                  completion, once only. Course invoices and payments are
                  retained; no completion charge is created automatically.
                </p>
              </FormSection>
              <FormSection title="Status & documentation audit timeline">
                <ol className="session-audit">
                  {r.session!.audit.map((a) => (
                    <li key={a.id}>
                      <span />
                      <div>
                        <strong>{a.action}</strong>
                        <p>{a.note || a.status}</p>
                        <small>
                          {a.actor} ·{" "}
                          {new Date(a.at).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                          })}{" "}
                          IST
                        </small>
                      </div>
                    </li>
                  ))}
                </ol>
                {state.sessionCompletions
                  ?.filter((v) => v.sessionId === r.id)
                  .map((e) => (
                    <div className="session-completion-receipt" key={e.id}>
                      <Check size={17} />
                      <div>
                        <strong>Completion ledger · {e.id}</strong>
                        <p>
                          Package {e.packageBefore} → {e.packageAfter} remaining
                          · {e.units} unit consumed · ₹{e.chargeAmount}{" "}
                          automatic charge
                        </p>
                      </div>
                    </div>
                  ))}
              </FormSection>
            </>
          )}
          {busy && (
            <p role="status" className="session-demo-note">
              Reading original demo images…
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="session-primary-actions">
            <span>
              <strong>{dirty ? "Unsaved changes" : "Saved record"}</strong>
              <small>{r.status}</small>
            </span>
            {step > 0 && (
              <button
                className="button secondary"
                onClick={() => setStep(step - 1)}
              >
                Back
              </button>
            )}
            {step < 3 && (
              <button
                className="button secondary"
                onClick={() => setStep(step + 1)}
              >
                Next section
              </button>
            )}
            {!readOnly && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={save}
              >
                <Save size={13} />
                Save Draft
              </button>
            )}
            {transitions.map((t) => (
              <button
                className={
                  "button " +
                  (["Cancelled", "No-show"].includes(t)
                    ? "secondary"
                    : "primary")
                }
                disabled={busy}
                key={t}
                onClick={() => openDialog(t)}
              >
                {t === "Checked In"
                  ? "Check In"
                  : t === "In Preparation"
                    ? "Begin Preparation"
                    : t === "In Progress"
                      ? "Start Session"
                      : t === "Awaiting Review"
                        ? "Submit for Review"
                        : t === "Completed"
                          ? "Complete Sitting"
                          : t === "No-show"
                            ? "Mark No-show"
                            : "Cancel Sitting"}
              </button>
            ))}
          </div>
        </div>
        <SessionContext
          state={state}
          record={r}
          draft={draft}
          previous={previous}
          onPatient={() => go("/patients/" + r.patientId)}
          onCourse={() => go("/treatment-plans/courses/" + r.courseId)}
          onPrevious={() => setDialog("compare")}
        />
      </div>
      {config && (
        <ConfigurationDialog
          machineId={draft.machineId}
          role={role}
          onClose={() => setConfig(false)}
          onSave={(next, message) => {
            if (commit(next, message, true)) {
              setDraft((d) => ({
                ...d,
                parameters: {},
                checks: { ...d.checks, parameters: false },
                parameterApprovalBy: "",
                parameterApprovalNote: "",
                parameterApprovedAt: undefined,
              }));
              setDirty(true);
              return true;
            }
            return false;
          }}
        />
      )}
      {preview && (
        <AssetViewer asset={preview} onClose={() => setPreview(null)} />
      )}{" "}
      {discard && (
        <DiscardDialog
          onKeep={() => setDiscard(false)}
          onDiscard={() => navigate(pendingPath || "/sittings-sessions")}
        />
      )}
      <SessionDialogs
        action={dialog}
        record={r}
        draft={draft}
        previous={previous}
        state={state}
        error={error}
        setError={setError}
        reason={reason}
        setReason={setReason}
        date={date}
        setDate={setDate}
        time={time}
        setTime={setTime}
        confirmed={confirm}
        setConfirmed={setConfirm}
        update={update}
        act={act}
        close={() => setDialog("")}
        go={go}
        commit={commit}
      />
    </div>
  );
}
