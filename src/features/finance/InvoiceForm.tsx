import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Modal } from "../../components";
import { DEMO_DATE } from "../../data";
import { lineKinds, type InvoiceData, type InvoiceLine } from "./model";
import { saveInvoice } from "./services";
import {
  FinanceHeader,
  FinanceError,
  Totals,
  useFinanceSave,
} from "./FinanceUI";
const blankLine = (): InvoiceLine => ({
  id: crypto.randomUUID(),
  kind: "Consultation",
  description: "Clinic consultation",
  quantity: 1,
  price: 1500,
  discount: 0,
  taxIds: [],
});
export default function InvoiceForm() {
  const { invoiceId } = useParams(),
    navigate = useNavigate(),
    { state, save, error } = useFinanceSave(),
    old = state.records["Packages & Billing"].find((i) => i.id === invoiceId);
  const [id] = useState(() => old?.id || "invoice-" + crypto.randomUUID()),
    [patientId, setPatient] = useState(old?.patientId || ""),
    [d, setD] = useState<InvoiceData>(() =>
      old?.invoice
        ? structuredClone(old.invoice)
        : {
            number: "Assigned on save",
            state: "Draft",
            issueDate: DEMO_DATE,
            dueDate: DEMO_DATE,
            lines: [blankLine()],
            discount: 0,
            taxes: structuredClone(state.taxConfiguration || []).filter(
              (t) => t.active,
            ),
            notes: "",
            events: [],
          },
    ),
    [confirm, setConfirm] = useState(false),
    [discard, setDiscard] = useState(false),
    [dirty, setDirty] = useState(false);
  const update = (patch: Partial<InvoiceData>) => {
    setD({ ...d, ...patch });
    setDirty(true);
    setConfirm(false);
  };
  const changeLine = (id: string, patch: Partial<InvoiceLine>) =>
    update({
      lines: d.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    });
  const close = () => (dirty ? setDiscard(true) : navigate("/invoices"));
  if (invoiceId && (!old?.invoice || old.invoice.state !== "Draft"))
    return (
      <section className="card operations-room">
        <h1>Invoice cannot be edited</h1>
        <p>Only saved drafts can be edited.</p>
        <Link className="button" to="/invoices">
          Invoice library
        </Link>
      </section>
    );
  const submit = (issue: boolean) => {
    if (
      save(
        (s) =>
          saveInvoice(
            s,
            {
              ...old,
              id,
              name: d.number,
              detail: "",
              status: "Draft",
              amount: 0,
              patientId,
              date: d.issueDate,
              dueDate: d.dueDate,
              invoice: d,
            },
            issue,
            confirm,
          ),
        issue
          ? "Demo invoice issued; no payment collected"
          : "Invoice draft saved",
      )
    )
      navigate("/invoices/" + id);
  };
  return (
    <div className="finance-page">
      <FinanceHeader
        title={old ? "Edit draft invoice" : "Create invoice"}
        description="Itemised clinic billing with explicit discounts and per-line tax choices."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
      >
        <div className="finance-workspace">
          <div>
            <section className="card operations-room">
              <h2>Patient & invoice dates</h2>
              <div className="operations-form">
                <label>
                  Patient
                  <select
                    required
                    aria-label="Invoice patient"
                    value={patientId}
                    onChange={(e) => {
                      setPatient(e.target.value);
                      setDirty(true);
                      setConfirm(false);
                    }}
                  >
                    <option value="">Select registered patient</option>
                    {state.patients
                      .filter((p) => p.status !== "Archived")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.id}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Issue date
                  <input
                    required
                    aria-label="Invoice issue date"
                    type="date"
                    value={d.issueDate}
                    onChange={(e) => update({ issueDate: e.target.value })}
                  />
                </label>
                <label>
                  Due date
                  <input
                    required
                    aria-label="Invoice due date"
                    type="date"
                    value={d.dueDate}
                    onChange={(e) => update({ dueDate: e.target.value })}
                  />
                </label>
              </div>
            </section>
            <section className="card operations-room">
              <div className="operations-split">
                <h2>Invoice line items</h2>
                <button
                  type="button"
                  className="button"
                  onClick={() => update({ lines: [...d.lines, blankLine()] })}
                >
                  + Add line item
                </button>
              </div>
              <p className="muted">
                Discounts are fixed INR amounts. Adding a product charge does
                not adjust inventory; record actual stock usage separately.
              </p>
              {d.lines.map((l, i) => (
                <fieldset className="finance-line" key={l.id}>
                  <legend>Line {i + 1}</legend>
                  <div className="operations-form">
                    <label>
                      Charge type
                      <select
                        aria-label={"Charge type " + (i + 1)}
                        value={l.kind}
                        onChange={(e) =>
                          changeLine(l.id, {
                            kind: e.target.value as InvoiceLine["kind"],
                            productId: undefined,
                            packageId: undefined,
                          })
                        }
                      >
                        {lineKinds.map((k) => (
                          <option key={k}>{k}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Use clinic item
                      <select
                        aria-label={"Clinic item " + (i + 1)}
                        value=""
                        onChange={(e) => {
                          const type =
                              l.kind === "Product"
                                ? "Inventory"
                                : l.kind === "Package"
                                  ? "Package Catalogue"
                                  : "Treatment Catalogue",
                            r = state.records[type].find(
                              (r) => r.id === e.target.value,
                            );
                          if (r)
                            changeLine(l.id, {
                              description: r.name,
                              price:
                                r.inventory?.sellingPrice ??
                                (r.packageConfig
                                  ? r.packageConfig.price -
                                    r.packageConfig.discount
                                  : (r.treatment?.individualPrice ?? r.amount)),
                              productId:
                                l.kind === "Product" ? r.id : undefined,
                              packageId:
                                l.kind === "Package" ? r.id : undefined,
                            });
                        }}
                      >
                        <option value="">
                          Custom / select configured item
                        </option>
                        {state.records[
                          l.kind === "Product"
                            ? "Inventory"
                            : l.kind === "Package"
                              ? "Package Catalogue"
                              : "Treatment Catalogue"
                        ]
                          .filter((r) => r.status !== "Inactive")
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Description
                      <input
                        required
                        aria-label={"Line description " + (i + 1)}
                        value={l.description}
                        onChange={(e) =>
                          changeLine(l.id, { description: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Quantity
                      <input
                        required
                        aria-label={"Line quantity " + (i + 1)}
                        type="number"
                        step="any"
                        min="0.01"
                        value={l.quantity}
                        onChange={(e) =>
                          changeLine(l.id, { quantity: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label>
                      Unit price (INR)
                      <input
                        required
                        aria-label={"Line price " + (i + 1)}
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.price}
                        onChange={(e) =>
                          changeLine(l.id, { price: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label>
                      Line discount (INR)
                      <input
                        required
                        aria-label={"Line discount " + (i + 1)}
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.discount}
                        onChange={(e) =>
                          changeLine(l.id, { discount: Number(e.target.value) })
                        }
                      />
                    </label>
                  </div>
                  <div className="finance-tax-choices">
                    <strong>Apply configured taxes</strong>
                    {d.taxes.length ? (
                      d.taxes.map((t) => (
                        <label key={t.id}>
                          <input
                            type="checkbox"
                            checked={l.taxIds.includes(t.id)}
                            onChange={(e) =>
                              changeLine(l.id, {
                                taxIds: e.target.checked
                                  ? [...l.taxIds, t.id]
                                  : l.taxIds.filter((id) => id !== t.id),
                              })
                            }
                          />
                          {t.name} ({t.rate}%)
                        </label>
                      ))
                    ) : (
                      <small>
                        No tax lines configured. Tax applicability requires
                        clinic review.
                      </small>
                    )}
                  </div>
                  <button
                    type="button"
                    className="button"
                    onClick={() =>
                      update({ lines: d.lines.filter((v) => v.id !== l.id) })
                    }
                  >
                    Remove line {i + 1}
                  </button>
                </fieldset>
              ))}
            </section>
            <section className="card operations-room">
              <h2>Tax snapshot & notes</h2>
              <p>
                Apply a tax only to the relevant line items. These are editable
                clinic entries, not advice on GST applicability. Invoice-level
                discounts reduce taxable bases proportionally.
              </p>
              {d.taxes.map((t, i) => (
                <div className="finance-tax-edit" key={t.id}>
                  <label>
                    Tax label
                    <input
                      aria-label={"Invoice tax label " + (i + 1)}
                      value={t.name}
                      onChange={(e) =>
                        update({
                          taxes: d.taxes.map((v) =>
                            v.id === t.id ? { ...v, name: e.target.value } : v,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Rate (%)
                    <input
                      aria-label={"Invoice tax rate " + (i + 1)}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={t.rate}
                      onChange={(e) =>
                        update({
                          taxes: d.taxes.map((v) =>
                            v.id === t.id
                              ? { ...v, rate: Number(e.target.value) }
                              : v,
                          ),
                        })
                      }
                    />
                  </label>
                </div>
              ))}
              <button
                type="button"
                className="button"
                onClick={() =>
                  update({
                    taxes: [
                      ...d.taxes,
                      {
                        id: crypto.randomUUID(),
                        name: "Custom clinic tax",
                        rate: 0,
                        active: true,
                      },
                    ],
                  })
                }
              >
                + Add invoice tax
              </button>
              <label className="finance-notes-label">
                Invoice notes / terms
                <textarea
                  aria-label="Invoice notes"
                  value={d.notes}
                  onChange={(e) => update({ notes: e.target.value })}
                />
              </label>
            </section>
          </div>
          <aside className="card operations-room finance-summary">
            <span className="eyebrow">DRAFT / NOT COLLECTED</span>
            <h2>Invoice summary</h2>
            <label>
              Invoice discount (INR)
              <input
                aria-label="Invoice discount"
                min="0"
                step="0.01"
                type="number"
                value={d.discount}
                onChange={(e) => update({ discount: Number(e.target.value) })}
              />
            </label>
            <Totals invoice={d} />
            <label className="operations-confirm">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
              />
              I confirm the patient, charges, discounts and tax applicability
              before issuing this demo invoice.
            </label>
            <FinanceError error={error} />
            <div className="finance-save-actions">
              <button type="submit" className="button">
                Save draft
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => submit(true)}
              >
                Issue invoice
              </button>
              <button type="button" className="button" onClick={close}>
                Cancel
              </button>
            </div>
            <small>
              Issued invoices are immutable. Record payments separately; issuing
              does not collect money.
            </small>
          </aside>
        </div>
      </form>
      {discard && (
        <Modal
          title="Discard unsaved invoice?"
          onClose={() => setDiscard(false)}
        >
          <p>The saved ledger will stay unchanged.</p>
          <div className="modal-actions">
            <button className="button" onClick={() => setDiscard(false)}>
              Keep editing
            </button>
            <button
              className="button danger"
              onClick={() => navigate("/invoices")}
            >
              Discard changes
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
