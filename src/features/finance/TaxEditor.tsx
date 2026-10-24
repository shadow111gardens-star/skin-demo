import { useState } from "react";
import { Modal } from "../../components";
import { useFinanceSave, FinanceError } from "./FinanceUI";
import { saveTaxConfiguration } from "./services";
export default function TaxEditor({ onClose }: { onClose: () => void }) {
  const { state, save, error } = useFinanceSave(),
    [taxes, setTaxes] = useState(() =>
      structuredClone(state.taxConfiguration || []),
    );
  return (
    <Modal
      title="Clinic tax configuration"
      className="operations-modal"
      onClose={onClose}
    >
      <p>
        Editable clinic configuration, not GST advice. Apply only the relevant
        taxes to each invoice line. Issued invoices retain their own tax
        snapshots.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (
            save(
              (s) => saveTaxConfiguration(s, taxes),
              "Clinic tax defaults saved",
            )
          )
            onClose();
        }}
      >
        {taxes.map((t, i) => (
          <div className="finance-tax-edit" key={t.id}>
            <label>
              Tax label
              <input
                aria-label={"Tax label " + (i + 1)}
                required
                value={t.name}
                onChange={(e) =>
                  setTaxes(
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
                aria-label={"Tax rate " + (i + 1)}
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
                value={t.rate}
                onChange={(e) =>
                  setTaxes(
                    taxes.map((v) =>
                      v.id === t.id
                        ? { ...v, rate: Number(e.target.value) }
                        : v,
                    ),
                  )
                }
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={t.active}
                onChange={(e) =>
                  setTaxes(
                    taxes.map((v) =>
                      v.id === t.id ? { ...v, active: e.target.checked } : v,
                    ),
                  )
                }
              />
              Available on new invoices
            </label>
          </div>
        ))}
        <button
          type="button"
          className="button"
          onClick={() =>
            setTaxes([
              ...taxes,
              { id: crypto.randomUUID(), name: "", rate: 0, active: true },
            ])
          }
        >
          + Add tax configuration
        </button>
        <FinanceError error={error} />
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary">Save configuration</button>
        </div>
      </form>
    </Modal>
  );
}
