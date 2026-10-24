import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Modal, Badge } from "../../components";
import { DEMO_DATE } from "../../data";
import { Metrics, Empty, DetailList } from "../operations/OperationsUI";
import { FinanceHeader, useFinanceSave } from "./FinanceUI";
import { financeSummary, inr, accountCredit } from "./ledger";
import { methods } from "./model";
import PaymentForm from "./PaymentForm";
export default function Payments() {
  const { state } = useFinanceSave(),
    [params] = useSearchParams(),
    [q, setQ] = useState(""),
    [from, setFrom] = useState(params.get("date") || "2026-10-01"),
    [to, setTo] = useState(params.get("date") || DEMO_DATE),
    [method, setMethod] = useState(""),
    [kind, setKind] = useState(""),
    [patient, setPatient] = useState(params.get("patient") || ""),
    [create, setCreate] = useState(false),
    [refund, setRefund] = useState<string>(),
    [selected, setSelected] = useState(params.get("record") || "");
  useEffect(() => {
    setSelected(params.get("record") || "");
  }, [params]);
  const all = financeSummary(state, from, to),
    rows = all.payments
      .filter(
        (p) =>
          (
            p.name +
            " " +
            p.patientId +
            " " +
            p.payment?.reference +
            " " +
            p.payment?.note
          )
            .toLowerCase()
            .includes(q.toLowerCase()) &&
          (!method || p.payment?.method === method) &&
          (!kind || p.payment?.kind === kind) &&
          (!patient || p.patientId === patient),
      )
      .sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    r = state.records.Payments.find((p) => p.id === selected);
  return (
    <div className="finance-page">
      <FinanceHeader
        title="Payments"
        description="Explicit demo receipts, deposits and refunds. No real transactions."
        actions={
          <button className="button primary" onClick={() => setCreate(true)}>
            + Record payment
          </button>
        }
      />
      <Metrics
        items={[
          [
            "Filtered receipts",
            inr(
              rows
                .filter((p) => p.payment?.kind === "Receipt")
                .reduce((n, p) => n + p.amount, 0),
            ),
          ],
          [
            "Filtered refunds",
            inr(
              rows
                .filter((p) => p.payment?.kind === "Refund")
                .reduce((n, p) => n + p.amount, 0),
            ),
          ],
          [
            "Net recorded collections",
            inr(
              rows.reduce(
                (n, p) =>
                  n + (p.payment?.kind === "Refund" ? -p.amount : p.amount),
                0,
              ),
            ),
          ],
          [
            "Patient account credit",
            patient ? inr(accountCredit(state, patient)) : "Select a patient",
          ],
        ]}
      />
      <div className="operations-filters card">
        <label>
          Search
          <input
            aria-label="Search payments"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Patient, ID, reference or note"
          />
        </label>
        <label>
          From
          <input
            aria-label="Payments from date"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value || "2026-10-01")}
          />
        </label>
        <label>
          To
          <input
            aria-label="Payments to date"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value || DEMO_DATE)}
          />
        </label>
        <label>
          Patient
          <select
            aria-label="Payments patient filter"
            value={patient}
            onChange={(e) => setPatient(e.target.value)}
          >
            <option value="">All patients</option>
            {state.patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Method
          <select
            aria-label="Payment method filter"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            <option value="">All methods</option>
            {methods.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label>
          Entry
          <select
            aria-label="Payment kind filter"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">All entries</option>
            <option>Receipt</option>
            <option>Refund</option>
          </select>
        </label>
        <button
          className="button"
          onClick={() => {
            setQ("");
            setFrom("2026-10-01");
            setTo(DEMO_DATE);
            setMethod("");
            setKind("");
            setPatient("");
          }}
        >
          Reset
        </button>
      </div>
      {from > to && (
        <p role="alert" className="form-error">
          From date must be on or before to date.
        </p>
      )}
      <section className="card">
        <div className="finance-payment-row finance-table-head">
          <span>Patient / reference</span>
          <span>Date / method</span>
          <span>Entry / allocation</span>
          <span>Amount</span>
          <span>Actions</span>
        </div>
        {rows.map((p) => {
          const refundable =
            p.amount -
            state.records.Payments.filter(
              (v) => v.payment?.refundOf === p.id,
            ).reduce((n, v) => n + v.amount, 0);
          return (
            <div className="finance-payment-row" key={p.id}>
              <div>
                <Link className="text-link" to={"/patients/" + p.patientId}>
                  {p.name}
                </Link>
                <small>
                  {p.patientId} ·{" "}
                  {p.payment?.reference || "No external reference"}
                </small>
              </div>
              <div>
                <span>{p.date}</span>
                <small>{p.payment?.method}</small>
              </div>
              <div>
                <Badge>{p.payment?.kind}</Badge>
                <small>
                  {p.payment?.invoiceId ? (
                    <Link
                      className="text-link"
                      to={"/invoices/" + p.payment.invoiceId}
                    >
                      Linked invoice
                    </Link>
                  ) : (
                    "On-account / unallocated deposit"
                  )}
                </small>
              </div>
              <strong className="finance-number">
                {p.payment?.kind === "Refund" ? "−" : ""}
                {inr(p.amount)}
              </strong>
              <div className="operations-actions">
                <button className="button" onClick={() => setSelected(p.id)}>
                  Details
                </button>
                {p.payment?.kind === "Receipt" && refundable > 0 && (
                  <button className="button" onClick={() => setRefund(p.id)}>
                    Refund
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!rows.length && <Empty>No payment entries match these filters.</Empty>}
      </section>
      {create && (
        <PaymentForm patientId={patient} onClose={() => setCreate(false)} />
      )}
      {refund && (
        <PaymentForm refundOf={refund} onClose={() => setRefund(undefined)} />
      )}
      {r && (
        <Modal
          title="Payment ledger entry"
          className="operations-modal"
          onClose={() => setSelected("")}
        >
          <Badge>{r.payment?.kind}</Badge>
          <DetailList
            items={[
              ["Patient", r.name],
              ["Patient ID", r.patientId],
              ["Entry amount", inr(r.amount)],
              ["Date", r.date],
              ["Method", r.payment?.method],
              ["Reference", r.payment?.reference],
              ["Notes", r.payment?.note],
              [
                "Allocation",
                r.payment?.invoiceId || "Unallocated patient account",
              ],
              [
                "Original receipt",
                r.payment?.refundOf || "This is an original receipt",
              ],
              ["Ledger ID", r.id],
            ]}
          />
          {r.payment?.invoiceId && (
            <Link className="button" to={"/invoices/" + r.payment.invoiceId}>
              Open invoice
            </Link>
          )}
          <p>
            Retained fictional ledger entry. Payments are corrected through
            explicit refunds, never deleted.
          </p>
        </Modal>
      )}
    </div>
  );
}
