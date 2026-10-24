import { useState } from "react";
import { Modal } from "../../components";
import { useClinic } from "../../store";
import type { TaxConfig } from "../finance/model";
import { saveTaxes } from "./settingsServices";
export default function TaxSettings({
  onDirty,
}: {
  onDirty: (dirty: boolean) => void;
}) {
  const { state, setState, notify } = useClinic(),
    [taxes, setTaxes] = useState(() =>
      structuredClone(state.taxConfiguration || []),
    ),
    [saved, setSaved] = useState(JSON.stringify(state.taxConfiguration || [])),
    [error, setError] = useState(""),
    [reset, setReset] = useState(false);
  const dirty = JSON.stringify(taxes) !== saved,
    update = (next: TaxConfig[]) => {
      setTaxes(next);
      onDirty(JSON.stringify(next) !== saved);
      setError("");
    };
  return (
    <section className="card admin-editor">
      <div className="admin-section-heading">
        <h2>Tax Configuration</h2>
        <span className={"admin-save-state " + (dirty ? "dirty" : "")}>
          {dirty ? "Unsaved changes" : "Saved locally"}
        </span>
      </div>
      <p className="admin-note">
        Editable clinic tax labels and rates, not GST advice. New invoices use
        active configurations; taxes are chosen explicitly per line. Issued
        invoices retain their snapshots.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            setState(saveTaxes(state, taxes));
            setSaved(JSON.stringify(taxes));
            onDirty(false);
            setError("");
            notify("Clinic tax configuration saved");
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "Could not save tax configuration",
            );
          }
        }}
      >
        {taxes.map((t, i) => (
          <fieldset className="admin-schema-field" key={t.id}>
            <legend>Tax configuration {i + 1}</legend>
            <div className="admin-form-fields">
              <label>
                Tax label
                <input
                  required
                  aria-label={"Settings tax label " + (i + 1)}
                  value={t.name}
                  onChange={(e) =>
                    update(
                      taxes.map((v) =>
                        v.id === t.id ? { ...v, name: e.target.value } : v,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Rate (%)
                <input
                  required
                  aria-label={"Settings tax rate " + (i + 1)}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={t.rate}
                  onChange={(e) =>
                    update(
                      taxes.map((v) =>
                        v.id === t.id
                          ? { ...v, rate: Number(e.target.value) }
                          : v,
                      ),
                    )
                  }
                />
              </label>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={t.active}
                  onChange={(e) =>
                    update(
                      taxes.map((v) =>
                        v.id === t.id ? { ...v, active: e.target.checked } : v,
                      ),
                    )
                  }
                />
                Available on new invoices
              </label>
            </div>
          </fieldset>
        ))}
        <button
          type="button"
          className="button"
          onClick={() =>
            update([
              ...taxes,
              { id: crypto.randomUUID(), name: "", rate: 0, active: true },
            ])
          }
        >
          + Add tax configuration
        </button>
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
              const current = structuredClone(state.taxConfiguration || []);
              setTaxes(current);
              setSaved(JSON.stringify(current));
              onDirty(false);
              setError("");
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
          title="Restore default tax draft?"
          onClose={() => setReset(false)}
        >
          <p>
            Load the fictional zero-rate example configuration? Save Changes is
            still required; existing issued invoices are retained.
          </p>
          <div className="modal-actions">
            <button className="button" onClick={() => setReset(false)}>
              Keep current draft
            </button>
            <button
              className="button"
              onClick={() => {
                update([
                  {
                    id: "tax-demo",
                    name: "Clinic configured tax (example)",
                    rate: 0,
                    active: true,
                  },
                ]);
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
