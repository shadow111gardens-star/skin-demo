import { useState } from "react";
import { Modal } from "../../components";
import { useClinic } from "../../store";
import { resetState } from "../../data";
import { formatINR } from "../../format";
import type { SettingSection } from "./model";
import {
  settingsForm,
  sectionOptions,
  saveSettingsSection,
} from "./settingsServices";
import SettingFields from "./SettingFields";
export default function SettingsEditor({
  section,
  id,
  onDirty,
}: {
  section: SettingSection;
  id: string;
  onDirty: (dirty: boolean) => void;
}) {
  const { state, setState, notify } = useClinic(),
    form = settingsForm(state, section, id),
    [values, setValues] = useState(form.values),
    [saved, setSaved] = useState(JSON.stringify(form.values)),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [reset, setReset] = useState(false);
  const dirty = JSON.stringify(values) !== saved;
  const change = (key: string, value: string) => {
    const next = { ...values, [key]: value };
    setValues(next);
    onDirty(JSON.stringify(next) !== saved);
    setError("");
    setConfirm(false);
  };
  const cancel = () => {
    const latest = settingsForm(state, section, id).values;
    setValues(latest);
    setSaved(JSON.stringify(latest));
    setError("");
    setConfirm(false);
    onDirty(false);
  };
  const needsConfirmation =
    section === "Rooms" &&
    state.records["Rooms & Resources"].find((r) => r.id === id)?.status !==
      values.status;
  const defaultsExist =
    !id || sectionOptions(resetState(), section).some((o) => o.value === id);
  return (
    <section className="card admin-editor">
      <div className="admin-section-heading">
        <div>
          <span className="eyebrow">CLINIC CONFIGURATION</span>
          <h2>{section}</h2>
        </div>
        <span className={"admin-save-state " + (dirty ? "dirty" : "")}>
          {dirty ? "Unsaved changes" : "Saved locally"}
        </span>
      </div>
      <p className="admin-note">{form.note}</p>
      {!form.fields.length ? (
        <p className="operations-empty">
          No configurable record is available. Open its directory to create one.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              setState(
                saveSettingsSection(state, section, id, values, confirm),
              );
              setSaved(JSON.stringify(values));
              setError("");
              onDirty(false);
              notify(section + " saved");
            } catch (e) {
              const message =
                e instanceof Error ? e.message : "Settings could not be saved";
              setError(message);
              notify(message, "error");
            }
          }}
        >
          <SettingFields
            fields={form.fields}
            values={values}
            onChange={change}
          />
          {section === "Currency" && (
            <div className="admin-preview">
              <strong>Shared INR preview</strong>
              <p>{formatINR(123456.5)}</p>
              <small>
                Save Changes applies the selected presentation to shared INR
                amounts. The ledger remains INR.
              </small>
            </div>
          )}
          {section === "Reminder Templates" && (
            <div className="admin-preview">
              <strong>Fictional draft preview · not sent</strong>
              <p>
                {(values.body || "")
                  .replaceAll("{firstName}", "Demo")
                  .replaceAll("{clinicName}", state.clinicName)
                  .replaceAll("{datePhrase}", " around 2026-10-24")
                  .replaceAll("{date}", "2026-10-24")}
              </p>
            </div>
          )}
          {needsConfirmation && (
            <label className="operations-confirm">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
              />
              I confirm this room availability change and its effect on new
              bookings.
            </label>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="admin-form-actions">
            <button type="submit" className="button primary" disabled={!dirty}>
              Save Changes
            </button>
            <button type="button" className="button" onClick={cancel}>
              Cancel
            </button>
            <button
              type="button"
              className="button"
              disabled={!defaultsExist}
              onClick={() => setReset(true)}
            >
              Reset to defaults
            </button>
          </div>
          {!defaultsExist && (
            <small className="admin-note">
              This custom record has no seeded factory defaults. Cancel restores
              its last saved values.
            </small>
          )}
        </form>
      )}
      {reset && (
        <Modal
          title="Restore section defaults?"
          onClose={() => setReset(false)}
        >
          <p>
            Load the fictional defaults for {section}? This replaces the draft
            in this form. Save Changes is still required; existing purchases and
            historical records are retained.
          </p>
          <div className="modal-actions">
            <button className="button" onClick={() => setReset(false)}>
              Keep current draft
            </button>
            <button
              className="button"
              onClick={() => {
                const defaults = settingsForm(resetState(), section, id).values;
                setValues(defaults);
                onDirty(JSON.stringify(defaults) !== saved);
                setConfirm(false);
                setError("");
                setReset(false);
              }}
            >
              Load defaults
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
