import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Modal, PageHeader } from "../../components";
import { useClinic } from "../../store";
import type { ClinicState } from "../../data";
export const actor = "Demo clinic operator";
export function useOperation() {
  const { state, setState, notify } = useClinic();
  return {
    state,
    commit: (update: (s: ClinicState) => ClinicState, message: string) => {
      try {
        const next = update(state);
        setState(next);
        notify(message);
        return true;
      } catch (e) {
        notify(e instanceof Error ? e.message : "Unable to save", "error");
        return false;
      }
    },
  };
}
export function OperationHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} eyebrow="CLINIC OPERATIONS" description={description} actions={action} />
      <p className="operations-notice">
        Fictional demo records · manually maintained availability and stock. No
        connected equipment or real-time telemetry.
      </p>
      <nav className="operations-links" aria-label="Operations modules">
        <Link aria-label="Operations: Machines" to="/machines-equipment">
          Machines
        </Link>
        <Link aria-label="Operations: Maintenance" to="/maintenance">
          Maintenance
        </Link>
        <Link
          aria-label="Operations: Rooms and resources"
          to="/rooms-resources"
        >
          Rooms & resources
        </Link>
        <Link aria-label="Operations: Inventory" to="/inventory">
          Inventory
        </Link>
      </nav>
    </>
  );
}
export function Metrics({ items }: { items: [string, string | number][] }) {
  return (
    <div className="operations-metrics">
      {items.map(([label, value]) => (
        <div className="card" key={label}>
          <small>{label}</small>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}
export interface Field {
  key: string;
  label: string;
  type?: string;
  options?: { value: string; label: string; disabled?: boolean }[];
  required?: boolean;
  readOnly?: boolean;
  help?: string;
}
export function OperationForm({
  title,
  fields,
  initial,
  children,
  onSave,
  onClose,
  confirmation,
}: {
  title: string;
  fields: Field[];
  initial: Record<string, string>;
  children?: ReactNode | ((values: Record<string, string>) => ReactNode);
  onSave: (values: Record<string, string>, confirmed: boolean) => boolean;
  onClose: () => void;
  confirmation?: string;
}) {
  const [values, setValues] = useState(initial),
    [confirm, setConfirm] = useState(false),
    [dirty, setDirty] = useState(false),
    [discard, setDiscard] = useState(false),
    [error, setError] = useState("");
  const close = () => (dirty ? setDiscard(true) : onClose());
  return (
    <>
      <Modal title={title} onClose={close} className="operations-modal">
        <form
          onChange={() => setDirty(true)}
          onSubmit={(e) => {
            e.preventDefault();
            if (confirmation && !confirm) {
              setError("Confirm the effect of this change before saving.");
              return;
            }
            if (onSave(values, confirm)) onClose();
            else
              setError(
                "Unable to save. Check the highlighted feedback and your entries.",
              );
          }}
        >
          <div className="operations-form">
            {fields.map((f) => (
              <label key={f.key}>
                {f.label}
                {f.required ? " *" : ""}
                {f.options ? (
                  <select
                    aria-label={f.label + (f.required ? " *" : "")}
                    required={f.required}
                    value={values[f.key] || ""}
                    onChange={(e) => {
                      setDirty(true);
                      setValues({ ...values, [f.key]: e.target.value });
                    }}
                  >
                    {f.options.map((o) => (
                      <option
                        key={o.value}
                        value={o.value}
                        disabled={o.disabled}
                      >
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    aria-label={f.label + (f.required ? " *" : "")}
                    required={f.required}
                    value={values[f.key] || ""}
                    onChange={(e) => {
                      setDirty(true);
                      setValues({ ...values, [f.key]: e.target.value });
                    }}
                  />
                ) : (
                  <input
                    aria-label={f.label + (f.required ? " *" : "")}
                    required={f.required}
                    readOnly={f.readOnly}
                    type={f.type || "text"}
                    step={f.type === "number" ? "any" : undefined}
                    min={f.type === "number" ? 0 : undefined}
                    value={values[f.key] || ""}
                    onChange={(e) => {
                      setDirty(true);
                      setValues({ ...values, [f.key]: e.target.value });
                    }}
                  />
                )}
                {f.help && <small>{f.help}</small>}
              </label>
            ))}
          </div>
          {typeof children === "function" ? children(values) : children}
          {confirmation && (
            <label className="operations-confirm">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => {
                  setConfirm(e.target.checked);
                  setDirty(true);
                }}
              />
              {confirmation}
            </label>
          )}
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button type="button" className="button" onClick={close}>
              Cancel
            </button>
            <button className="button primary" type="submit">
              Save{" "}
              {title.toLowerCase().includes("stock") ? "adjustment" : "changes"}
            </button>
          </div>
        </form>
      </Modal>
      {discard && (
        <Modal
          title="Discard unsaved changes?"
          onClose={() => setDiscard(false)}
        >
          <p>Your saved records will stay unchanged.</p>
          <div className="modal-actions">
            <button className="button" onClick={() => setDiscard(false)}>
              Keep editing
            </button>
            <button className="button danger" onClick={onClose}>
              Discard changes
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
export const options = (values: string[]) =>
  values.map((v) => ({ value: v, label: v }));
export function Empty({ children }: { children: ReactNode }) {
  return <div className="operations-empty">{children}</div>;
}
export function DetailList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="operations-details">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>
            {v === undefined || v === null || v === "" ? "Not recorded" : v}
          </dd>
        </div>
      ))}
    </dl>
  );
}
