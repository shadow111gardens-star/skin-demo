import { ArrowUpRight } from "lucide-react";
import { Modal } from "../../components";
import { clinicDoctors } from "../admin/access";
import { DEMO_DATE, type ClinicState, type RecordItem } from "../../data";
import { recordConsent } from "./services";
import type { SessionData } from "./model";
interface Props {
  action: string;
  record: RecordItem;
  draft: SessionData;
  previous?: RecordItem;
  state: ClinicState;
  error: string;
  setError: (s: string) => void;
  reason: string;
  setReason: (s: string) => void;
  date: string;
  setDate: (s: string) => void;
  time: string;
  setTime: (s: string) => void;
  confirmed: boolean;
  setConfirmed: (b: boolean) => void;
  update: (d: Partial<SessionData>) => void;
  act: () => void;
  close: () => void;
  go: (s: string) => void;
  commit: (s: ClinicState, message: string, preserveDraft?: boolean) => boolean;
}
export default function SessionDialogs(p: Props) {
  const { action, draft, record: r, previous } = p;
  if (!action) return null;
  if (action === "compare")
    return (
      <Modal
        title="Previous sitting comparison"
        className="session-compare-modal"
        onClose={p.close}
      >
        <div className="session-comparison-heading">
          <span>
            <small>PREVIOUS · {previous?.date}</small>
            <strong>Sitting {previous?.session?.number || "—"}</strong>
          </span>
          <span>
            <small>CURRENT · {r.date}</small>
            <strong>Sitting {draft.number}</strong>
          </span>
        </div>
        <p className="clinical-footnote">
          Reference documentation only. Values are not copied. Compare only the
          same recorded fields, units and device configuration.
        </p>
        {previous?.session?.parameterSchema.length ? (
          <div className="session-parameter-comparison">
            {previous.session.parameterSchema.map((f) => (
              <div key={f.id}>
                <strong>
                  {f.label} ({f.unit})
                </strong>
                <span>
                  {previous.session?.parameters[f.id] || "Not recorded"}
                </span>
                <span>
                  {draft.machineId !== previous.session?.machineId
                    ? "Different device"
                    : draft.parameterSchema.find((v) => v.id === f.id)?.unit !==
                        f.unit
                      ? "Unit/configuration differs"
                      : draft.parameters[f.id] || "Not recorded"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="session-routine">
            <p>
              No structured settings are available in the retained previous
              record. Values and machine specifications have not been inferred.
            </p>
          </div>
        )}
        <dl className="clinical-detail-grid">
          <div>
            <dt>Previous procedure / source note</dt>
            <dd>
              {previous?.session?.procedureNotes ||
                previous?.detail ||
                "No previous record"}
            </dd>
          </div>
          <div>
            <dt>Previous reaction</dt>
            <dd>
              {previous?.session?.reactionNotes ||
                previous?.session?.reaction ||
                "Not recorded"}
            </dd>
          </div>
        </dl>
        {previous && (
          <button
            className="button secondary"
            onClick={() => p.go("/sittings-sessions/" + previous.id)}
          >
            Open previous sitting
            <ArrowUpRight size={13} />
          </button>
        )}
      </Modal>
    );
  if (action === "consent")
    return (
      <Modal title="Record fictional session consent" onClose={p.close}>
        <div className="clinical-form">
          <p>
            This records a fictional consent attestation for the selected
            patient/course. It does not collect a real signature.
          </p>
          <label>
            Witnessing clinician
            <select
              aria-label="Consent witnessing clinician"
              value={draft.reviewingDoctor}
              onChange={(e) => p.update({ reviewingDoctor: e.target.value })}
            >
              {clinicDoctors(p.state).map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            Consent documentation note
            <textarea
              aria-label="Consent documentation note"
              value={p.reason}
              onChange={(e) => p.setReason(e.target.value)}
            />
          </label>
          <label className="session-checkbox">
            <input
              type="checkbox"
              checked={p.confirmed}
              onChange={(e) => p.setConfirmed(e.target.checked)}
            />
            I confirm this is a fictional consent record and the relevant
            requirements were reviewed.
          </label>
          {p.error && (
            <p className="form-error" role="alert">
              {p.error}
            </p>
          )}
          <div className="form-actions">
            <button className="button secondary" onClick={p.close}>
              Cancel
            </button>
            <button
              className="button primary"
              onClick={() => {
                try {
                  if (!p.confirmed)
                    throw new Error(
                      "Confirm the fictional consent attestation.",
                    );
                  const next = recordConsent(
                    p.state,
                    r,
                    draft.reviewingDoctor,
                    p.reason,
                  );
                  if (
                    p.commit(next, "Fictional consent document recorded", true)
                  ) {
                    p.update({
                      consentStatus: "Recorded",
                      consentDocumentId: "consent-" + r.id,
                    });
                    p.close();
                  }
                } catch (err) {
                  p.setError((err as Error).message);
                }
              }}
            >
              Record Consent
            </button>
          </div>
        </div>
      </Modal>
    );
  return (
    <Modal
      title={
        action === "Completed"
          ? "Confirm clinician completion"
          : action === "reschedule"
            ? "Reschedule sitting"
            : action === "sitting"
              ? "Schedule next sitting"
              : action === "followup"
                ? "Book patient follow-up"
                : action === "Cancelled"
                  ? "Cancel this sitting?"
                  : action === "No-show"
                    ? "Mark patient no-show?"
                    : "Confirm " + action
      }
      className="session-action-modal"
      onClose={p.close}
    >
      <div className="clinical-form">
        <p>
          {action === "Completed"
            ? "Confirm the procedure and clinician review are complete. One qualifying package unit is deducted once; no new charge is generated."
            : action === "reschedule" ||
                action === "Cancelled" ||
                action === "No-show"
              ? "The audit history is preserved. This action does not consume a sitting or create a charge."
              : action === "In Progress"
                ? "Patient, consent, machine and clinician-approved documentation checks must pass. No parameter is generated."
                : "The existing patient, appointment and course links are preserved."}
        </p>
        {["reschedule", "sitting", "followup"].includes(action) && (
          <div className="clinical-fields">
            <label>
              Date
              <input
                aria-label="Action date"
                type="date"
                min={DEMO_DATE}
                value={p.date}
                onChange={(e) => p.setDate(e.target.value)}
              />
            </label>
            {action !== "followup" && (
              <label>
                Time (IST)
                <input
                  aria-label="Action time"
                  type="time"
                  value={p.time}
                  onChange={(e) => p.setTime(e.target.value)}
                />
              </label>
            )}
          </div>
        )}
        <label>
          Clinician / operational note
          <textarea
            aria-label="Session action note"
            value={p.reason}
            onChange={(e) => p.setReason(e.target.value)}
            placeholder="Record the reason, confirmation or booking note"
          />
        </label>
        {["Completed", "Cancelled", "No-show", "reschedule"].includes(
          action,
        ) && (
          <label className="session-checkbox">
            <input
              type="checkbox"
              checked={p.confirmed}
              onChange={(e) => p.setConfirmed(e.target.checked)}
            />
            {action === "Completed"
              ? "I reviewed the procedure, parameters/protocol, reaction assessment, aftercare and package balance."
              : "Confirm this change without a package deduction."}
          </label>
        )}
        {p.error && (
          <p className="form-error" role="alert">
            {p.error}
          </p>
        )}
        <div className="form-actions">
          <button className="button secondary" onClick={p.close}>
            Keep editing
          </button>
          <button
            className={
              "button " +
              (["Cancelled", "No-show"].includes(action) ? "danger" : "primary")
            }
            onClick={p.act}
          >
            {action === "Completed"
              ? "Confirm Completion"
              : action === "reschedule"
                ? "Confirm Reschedule"
                : action === "sitting"
                  ? "Confirm Next Sitting"
                  : action === "followup"
                    ? "Save Follow-up"
                    : "Confirm Status"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
