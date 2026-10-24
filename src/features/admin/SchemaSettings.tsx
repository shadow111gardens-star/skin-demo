import { useState } from "react";
import { Modal } from "../../components";
import { useClinic } from "../../store";
import type { DeviceDocumentation } from "../sessions/model";
import { saveSchema } from "./settingsServices";
import { clinicDoctors } from "./access";
export default function SchemaSettings({
  id,
  onDirty,
}: {
  id: string;
  onDirty: (dirty: boolean) => void;
}) {
  const { state, setState, notify } = useClinic(),
    m = state.records["Machines & Equipment"].find((m) => m.id === id);
  const initial = m?.deviceDocumentation || {
    fields: [],
    source: "",
    configuredBy: clinicDoctors(state)[0] || "Dr. Mehta",
    version: 0,
  };
  const [config, setConfig] = useState<DeviceDocumentation>(() =>
      structuredClone(initial),
    ),
    [saved, setSaved] = useState(JSON.stringify(initial)),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState(""),
    [reset, setReset] = useState(false);
  const dirty = JSON.stringify(config) !== saved;
  const update = (next: DeviceDocumentation) => {
    setConfig(next);
    onDirty(JSON.stringify(next) !== saved);
    setConfirm(false);
    setError("");
  };
  return (
    <section className="card admin-editor">
      <div className="admin-section-heading">
        <h2>Session Parameter Schemas</h2>
        <span className={"admin-save-state " + (dirty ? "dirty" : "")}>
          {dirty ? "Unsaved changes" : "Saved locally"}
        </span>
      </div>
      <p className="admin-note">
        Configure documentation labels, units and required fields from
        clinic-verified documentation. These are not machine specifications,
        prescribed settings or generated treatment values. Historical session
        snapshots are retained; a changed configuration requires fresh clinical
        review.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const next = saveSchema(state, id, config, confirm);
            setState(next);
            const savedConfig = next.records["Machines & Equipment"].find(
              (r) => r.id === id,
            )!.deviceDocumentation!;
            setConfig(savedConfig);
            setSaved(JSON.stringify(savedConfig));
            onDirty(false);
            setError("");
            setConfirm(false);
            notify("Session documentation schema saved");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not save schema");
          }
        }}
      >
        <div className="admin-form-fields">
          <label>
            Documentation source / reference
            <input
              aria-label="Schema documentation source"
              value={config.source}
              onChange={(e) => update({ ...config, source: e.target.value })}
            />
          </label>
          <label>
            Configuring clinician
            <input
              aria-label="Schema configuring clinician"
              value={config.configuredBy}
              onChange={(e) =>
                update({ ...config, configuredBy: e.target.value })
              }
            />
          </label>
        </div>
        {config.fields.map((f, i) => (
          <fieldset className="admin-schema-field" key={f.id}>
            <legend>Documentation field {i + 1}</legend>
            <div className="admin-form-fields">
              <label>
                Label
                <input
                  aria-label={"Schema field label " + (i + 1)}
                  required
                  value={f.label}
                  onChange={(e) =>
                    update({
                      ...config,
                      fields: config.fields.map((v) =>
                        v.id === f.id ? { ...v, label: e.target.value } : v,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Unit
                <input
                  aria-label={"Schema field unit " + (i + 1)}
                  required
                  value={f.unit}
                  placeholder="Enter the documented unit"
                  onChange={(e) =>
                    update({
                      ...config,
                      fields: config.fields.map((v) =>
                        v.id === f.id ? { ...v, unit: e.target.value } : v,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Value type
                <select
                  aria-label={"Schema field type " + (i + 1)}
                  value={f.type}
                  onChange={(e) =>
                    update({
                      ...config,
                      fields: config.fields.map((v) =>
                        v.id === f.id
                          ? { ...v, type: e.target.value as "number" | "text" }
                          : v,
                      ),
                    })
                  }
                >
                  <option value="number">Number</option>
                  <option value="text">Text</option>
                </select>
              </label>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={f.required}
                  onChange={(e) =>
                    update({
                      ...config,
                      fields: config.fields.map((v) =>
                        v.id === f.id
                          ? { ...v, required: e.target.checked }
                          : v,
                      ),
                    })
                  }
                />
                Required documentation
              </label>
            </div>
            <button
              type="button"
              className="button"
              onClick={() =>
                update({
                  ...config,
                  fields: config.fields.filter((v) => v.id !== f.id),
                })
              }
            >
              Remove field {i + 1}
            </button>
          </fieldset>
        ))}
        {!config.fields.length && (
          <p className="admin-preview">
            No parameter schema is configured. No medically meaningful values
            are automatically supplied.
          </p>
        )}
        <button
          type="button"
          className="button"
          onClick={() =>
            update({
              ...config,
              fields: [
                ...config.fields,
                {
                  id: crypto.randomUUID(),
                  label: "",
                  unit: "",
                  type: "number",
                  required: false,
                },
              ],
            })
          }
        >
          + Add documentation field
        </button>
        <label className="operations-confirm">
          <input
            type="checkbox"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
          />
          I confirm that changed schemas require renewed clinician review. No
          operating values are prescribed.
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="admin-form-actions">
          <button className="button primary" disabled={!dirty}>
            Save Changes
          </button>
          <button
            type="button"
            className="button"
            onClick={() => {
              setConfig(structuredClone(initial));
              setSaved(JSON.stringify(initial));
              onDirty(false);
              setError("");
              setConfirm(false);
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button"
            onClick={() => setReset(true)}
          >
            Reset to defaults
          </button>
        </div>
      </form>
      {reset && (
        <Modal
          title="Clear schema draft to defaults?"
          onClose={() => setReset(false)}
        >
          <p>
            Load the unconfigured default with no fields? Nothing changes until
            you save and confirm. Existing session documentation is retained.
          </p>
          <div className="modal-actions">
            <button className="button" onClick={() => setReset(false)}>
              Keep current schema
            </button>
            <button
              className="button"
              onClick={() => {
                update({
                  fields: [],
                  source: "",
                  configuredBy: clinicDoctors(state)[0] || "Dr. Mehta",
                  version: config.version,
                });
                setReset(false);
              }}
            >
              Load unconfigured defaults
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
