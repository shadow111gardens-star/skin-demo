import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Modal } from "../../components";
import {
  FinanceHeader,
  Totals,
  FinanceError,
  useFinanceSave,
} from "./FinanceUI";
import { invoicePaid, invoiceStatus, invoiceTotals, inr } from "./ledger";
import { issueInvoice, voidInvoice } from "./services";
import PaymentForm from "./PaymentForm";
export default function InvoiceDetail() {
  const { invoiceId } = useParams(),
    { state, save, error } = useFinanceSave(),
    [action, setAction] = useState(""),
    [reason, setReason] = useState(""),
    [confirm, setConfirm] = useState(false),
    [payment, setPayment] = useState(false),
    [refund, setRefund] = useState<string>();
  const r = state.records["Packages & Billing"].find((i) => i.id === invoiceId);
  if (!r?.invoice)
    return (
      <section className="card operations-room">
        <h1>Invoice not found</h1>
        <Link to="/invoices">Back to invoices</Link>
      </section>
    );
  const d = r.invoice,
    patient = state.patients.find((p) => p.id === r.patientId),
    paid = invoicePaid(state, r.id),
    payments = state.records.Payments.filter(
      (p) => p.payment?.invoiceId === r.id,
    ),
    total = invoiceTotals(d);
  return (
    <div className="finance-page">
      <FinanceHeader
        title={d.number}
        description="Invoice detail, receipt history and the current ledger balance."
        actions={
          <>
            <Link className="button" to="/invoices">
              All invoices
            </Link>
            {d.state === "Draft" && (
              <>
                <Link className="button" to={"/invoices/" + r.id + "/edit"}>
                  Edit draft
                </Link>
                <button
                  className="button primary"
                  onClick={() => {
                    setAction("issue");
                    setConfirm(false);
                  }}
                >
                  Issue invoice
                </button>
              </>
            )}
            {d.state === "Issued" && invoiceStatus(state, r) !== "Paid" && (
              <button
                className="button primary"
                onClick={() => setPayment(true)}
              >
                Record payment
              </button>
            )}
            <button
              className="button"
              onClick={() => {
                if (typeof window.print === "function") window.print();
              }}
            >
              Print invoice
            </button>
            {d.state !== "Void" && (
              <button
                className="button"
                onClick={() => {
                  setAction("void");
                  setConfirm(false);
                  setReason("");
                }}
              >
                Void invoice
              </button>
            )}
          </>
        }
      />
      <div className="finance-workspace">
        <article className="card operations-room finance-invoice">
          <div className="finance-invoice-header">
            <div>
              <span className="finance-brand">MMVerse</span>
              <h2>{state.clinicName}</h2>
              <small>
                {state.adminSettings?.profile.address || "Indiranagar, Bengaluru, Karnataka"} · Fictional clinic
              </small>
              <p>Demonstration invoice · INR</p>
            </div>
            <div>
              {d.state === "Issued" && <Badge>Issued</Badge>}
              <Badge>{invoiceStatus(state, r)}</Badge>
              <h2>
                {d.state === "Draft"
                  ? "DRAFT / NOT ISSUED"
                  : d.state === "Void"
                    ? "VOID INVOICE"
                    : "INVOICE"}
              </h2>
              <strong>{d.number}</strong>
              <p>
                {d.state === "Draft" ? "Proposed issue date" : "Issued"}: {d.issueDate}
                <br />
                Due: {d.dueDate}
              </p>
            </div>
          </div>
          <div className="finance-bill-to">
            <span className="eyebrow">BILL TO</span>
            <h3>{patient?.name}</h3>
            <Link className="text-link" to={"/patients/" + r.patientId}>
              {r.patientId} · Open patient
            </Link>
            <p>
              {patient?.phone}
              <br />
              {patient?.email}
              <br />
              {patient?.address || "Address not recorded"}
            </p>
            {r.courseId && (
              <Link
                className="text-link"
                to={"/treatment-plans/courses/" + r.courseId}
              >
                Linked treatment course
              </Link>
            )}
          </div>
          <div className="finance-invoice-lines">
            <div className="finance-invoice-line finance-table-head">
              <span>Description</span>
              <span>Qty</span>
              <span>Unit price</span>
              <span>Discount</span>
              <span>Net line</span>
            </div>
            {d.lines.map((l) => (
              <div className="finance-invoice-line" key={l.id}>
                <div>
                  <strong>{l.description}</strong>
                  <small>
                    {l.kind} ·{" "}
                    {l.taxIds
                      .map((id) => d.taxes.find((t) => t.id === id)?.name)
                      .join(", ") || "No tax selected"}
                  </small>
                </div>
                <span data-label="Quantity">{l.quantity}</span>
                <span data-label="Unit price">{inr(l.price)}</span>
                <span data-label="Discount">{inr(l.discount)}</span>
                <strong data-label="Net line">
                  {inr(l.quantity * l.price - l.discount)}
                </strong>
              </div>
            ))}
          </div>
          <div className="finance-invoice-total">
            <Totals invoice={d} paid={paid} />
          </div>
          <p>{d.notes || "No additional terms recorded."}</p>
          {d.state === "Void" && (
            <p className="finance-notice">Void reason: {d.voidReason}</p>
          )}
          <footer className="finance-print-footer">
            Fictional frontend demo. No real payment was processed. Tax labels
            and applicability are clinic-entered. This invoice has not been sent
            externally.
          </footer>
        </article>
        <aside className="card operations-room finance-summary">
          <h2>Ledger summary</h2>
          <dl className="operations-details">
            <div>
              <dt>Invoice value</dt>
              <dd>{inr(total.total)}</dd>
            </div>
            <div>
              <dt>Net applied receipts</dt>
              <dd>{inr(paid)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <Badge>{invoiceStatus(state, r)}</Badge>
              </dd>
            </div>
          </dl>
          <p>
            Drafts are estimates. Issued invoices create a receivable; only
            recorded receipts count as collections. Refunds reduce net receipts.
          </p>
          <h3>Audit history</h3>
          {d.events.map((e) => (
            <div className="operations-movement" key={e.id}>
              <strong>{e.action}</strong>
              <small>
                {new Date(e.at).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}{" "}
                IST
              </small>
              <p>{e.note}</p>
            </div>
          ))}
        </aside>
      </div>
      <section className="card operations-room">
        <h2>Payment history</h2>
        {payments.map((p) => {
          const refunded = state.records.Payments.filter(
            (v) => v.payment?.refundOf === p.id,
          ).reduce((n, v) => n + v.amount, 0);
          return (
            <div className="finance-transaction" key={p.id}>
              <div>
                <strong>
                  {p.payment?.kind} · {p.payment?.method}
                </strong>
                <small>
                  {p.date} · {p.payment?.reference || "No external reference"}
                </small>
                <p>{p.payment?.note}</p>
              </div>
              <strong className="finance-number">
                {p.payment?.kind === "Refund" ? "−" : ""}
                {inr(p.amount)}
              </strong>
              {p.payment?.kind === "Receipt" && refunded < p.amount && (
                <button className="button" onClick={() => setRefund(p.id)}>
                  Record refund
                </button>
              )}
            </div>
          );
        })}
        {!payments.length && (
          <p className="operations-empty">
            No receipts recorded against this invoice.
          </p>
        )}
      </section>
      {payment && (
        <PaymentForm invoiceId={r.id} onClose={() => setPayment(false)} />
      )}
      {refund && (
        <PaymentForm refundOf={refund} onClose={() => setRefund(undefined)} />
      )}
      {action && (
        <Modal
          title={action === "issue" ? "Issue demo invoice?" : "Void invoice?"}
          onClose={() => setAction("")}
        >
          <p>
            {action === "issue"
              ? `Issue ${d.number} for ${inr(total.total)}? No money will be collected.`
              : "Voiding preserves this record and audit history. Applied receipts must be explicitly refunded first."}
          </p>
          {action === "void" && (
            <label>
              Reason
              <textarea
                aria-label="Void reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
          <label className="operations-confirm">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
            />
            I confirm this invoice state change.
          </label>
          <FinanceError error={error} />
          <div className="modal-actions">
            <button className="button" onClick={() => setAction("")}>
              Cancel
            </button>
            <button
              className="button primary"
              onClick={() => {
                if (
                  save(
                    (s) =>
                      action === "issue"
                        ? issueInvoice(s, r.id, confirm)
                        : voidInvoice(s, r.id, reason, confirm),
                    action === "issue"
                      ? "Demo invoice issued"
                      : "Invoice voided",
                  )
                )
                  setAction("");
              }}
            >
              Confirm {action}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
