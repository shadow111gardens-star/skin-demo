import { useState } from "react";
import { Modal } from "../../components";
import { DEMO_DATE } from "../../data";

import { methods } from "./model";
import { invoiceBalance, inr, accountCredit, invoiceTotals } from "./ledger";
import { recordFinancePayment } from "./services";
import { useFinanceSave, FinanceError, FinanceDiscard } from "./FinanceUI";
export default function PaymentForm({
  patientId: initialPatient = "",
  invoiceId: initialInvoice = "",
  refundOf,
  courseId,
  title = "Record payment",
  onClose,
}: {
  patientId?: string;
  invoiceId?: string;
  refundOf?: string;
  courseId?: string;
  title?: string;
  onClose: () => void;
}) {
  const { state, save, error } = useFinanceSave(),
    [id] = useState(() => crypto.randomUUID());
  const original = state.records.Payments.find((p) => p.id === refundOf);
  const initial = state.records["Packages & Billing"].find(
    (i) =>
      i.id === initialInvoice ||
      (!initialInvoice &&
        !!initialPatient &&
        i.patientId === initialPatient &&
        (!courseId || i.courseId === courseId) &&
        i.invoice?.state === "Issued" &&
        invoiceBalance(state, i) > 0),
  );
  const [patientId, setPatient] = useState(
      original?.patientId ||
        initial?.patientId ||
        initialPatient ||
        state.patients[0]?.id ||
        "",
    ),
    [invoiceId, setInvoice] = useState(
      original?.payment?.invoiceId || initial?.id || initialInvoice,
    ),
    [amount, setAmount] = useState(
      initial ? String(invoiceBalance(state, initial)) : "",
    ),
    [date, setDate] = useState(DEMO_DATE),
    [method, setMethod] = useState<(typeof methods)[number]>("Cash"),
    [reference, setReference] = useState(""),
    [note, setNote] = useState(refundOf ? "" : "Fictional clinic receipt"),
    [confirm, setConfirm] = useState(false),
    [dirty, setDirty] = useState(false),
    [discard, setDiscard] = useState(false);
  const invoice = state.records["Packages & Billing"].find(
      (i) => i.id === invoiceId,
    ),
    invoices = state.records["Packages & Billing"].filter(
      (i) =>
        i.patientId === patientId &&
        i.invoice?.state === "Issued" &&
        invoiceBalance(state, i) > 0,
    ),
    refundable = original
      ? original.amount -
        state.records.Payments.filter(
          (p) => p.payment?.refundOf === original.id,
        ).reduce((n, p) => n + p.amount, 0)
      : 0;
  const close = () => (dirty ? setDiscard(true) : onClose());
  return (
    <>
      <Modal
        title={refundOf ? "Record refund" : title}
        className="operations-modal finance-payment"
        onClose={close}
      >
        <form
          onChange={() => {
            setDirty(true);
            setConfirm(false);
          }}
          onSubmit={(e) => {
            e.preventDefault();
            if (
              save(
                (s) =>
                  recordFinancePayment(
                    s,
                    {
                      id,
                      patientId,
                      invoiceId: invoiceId || undefined,
                      amount: Number(amount),
                      date,
                      method,
                      reference,
                      note,
                      refundOf,
                    },
                    confirm,
                  ),
                refundOf ? "Demo refund recorded" : "Demo payment recorded",
              )
            )
              onClose();
          }}
        >
          <p className="finance-notice">
            This records a fictional ledger entry only. No money is processed or
            transferred.
          </p>
          <div className="operations-form">
            <label>
              Patient
              <select
                aria-label="Patient"
                value={patientId}
                disabled={!!refundOf || !!initialPatient || !!initialInvoice}
                onChange={(e) => {
                  setPatient(e.target.value);
                  setInvoice("");
                  setAmount("");
                }}
              >
                {state.patients
                  .filter((p) => p.status !== "Archived" || p.id === patientId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.id}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Invoice
              <select
                aria-label="Invoice"
                disabled={!!refundOf}
                value={invoiceId}
                onChange={(e) => {
                  setInvoice(e.target.value);
                  const i = invoices.find((i) => i.id === e.target.value);
                  setAmount(i ? String(invoiceBalance(state, i)) : "");
                }}
              >
                <option value="">Patient account / unallocated deposit</option>
                {invoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.invoice?.number} · {inr(invoiceBalance(state, i))} due
                  </option>
                ))}
                {refundOf &&
                  invoice &&
                  !invoices.some((i) => i.id === invoice.id) && (
                    <option value={invoice.id}>
                      {invoice.invoice?.number}
                    </option>
                  )}
              </select>
            </label>
            {invoice && (
              <label>
                Invoice amount
                <input
                  aria-label="Invoice amount"
                  readOnly
                  value={String(invoiceTotals(invoice.invoice!).total)}
                />
              </label>
            )}
            <label>
              {refundOf ? "Refund amount (INR)" : "Amount (INR)"}
              <input
                required
                type="number"
                aria-label="Amount (INR)"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              Payment date
              <input
                aria-label="Payment date"
                type="date"
                required
                max={DEMO_DATE}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label>
              Method
              <select
                aria-label="Payment method"
                value={method}
                onChange={(e) => setMethod(e.target.value as typeof method)}
              >
                {methods.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label>
              Transaction / reference
              <input
                aria-label="Transaction reference"
                required={["UPI", "Card", "Bank Transfer"].includes(method)}
                value={reference}
                placeholder="Fictional reference; required for UPI/card/bank"
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
            <label>
              {refundOf ? "Refund reason" : "Note"}
              <textarea
                aria-label="Payment note"
                required
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>
          <div className="finance-confirm-summary">
            <strong>
              {refundOf ? "Refund" : "Receipt"}: {inr(Number(amount) || 0)}
            </strong>
            <p>
              {state.patients.find((p) => p.id === patientId)?.name} ·{" "}
              {invoice?.invoice?.number || "Unallocated patient account"} ·{" "}
              {method} · {date}
            </p>
            <small>
              {refundOf
                ? "Available to refund: " + inr(refundable)
                : invoice
                  ? "Current balance: " +
                    inr(invoiceBalance(state, invoice)) +
                    " · After receipt: " +
                    inr(
                      Math.max(
                        0,
                        invoiceBalance(state, invoice) - (Number(amount) || 0),
                      ),
                    )
                  : "Account credit: " +
                    inr(accountCredit(state, patientId)) +
                    "; deposits remain separate from invoice balances."}
            </small>
          </div>
          <label className="operations-confirm">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => {
                e.stopPropagation();
                setConfirm(e.target.checked);
              }}
            />
            I understand this records a simulated payment only
          </label>
          <FinanceError error={error} />
          <div className="modal-actions">
            <button type="button" className="button" onClick={close}>
              Cancel
            </button>
            <button className="button primary" type="submit">
              {refundOf ? "Save demo refund" : "Save demo payment"}
            </button>
          </div>
        </form>
      </Modal>
      {discard && (
        <FinanceDiscard onKeep={() => setDiscard(false)} onDiscard={onClose} />
      )}
    </>
  );
}
