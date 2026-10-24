import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "../../components";
import { DEMO_DATE } from "../../data";
import { Metrics, Empty } from "../operations/OperationsUI";
import { FinanceHeader, useFinanceSave } from "./FinanceUI";
import {
  financeSummary,
  invoiceStatus,
  invoiceTotals,
  invoicePaid,
  invoiceBalance,
  inr,
} from "./ledger";
import TaxEditor from "./TaxEditor";
export function InvoiceRows({
  rows,
  date = DEMO_DATE,
}: {
  rows: ReturnType<typeof financeSummary>["invoices"];
  date?: string;
}) {
  const { state } = useFinanceSave();
  return (
    <>
      <div className="finance-invoice-row finance-table-head">
        <span>Invoice / patient</span>
        <span>Issue / due date</span>
        <span>Status</span>
        <span>Total</span>
        <span>Net paid</span>
        <span>Balance</span>
      </div>
      {rows.map((r) => (
        <Link
          className="finance-invoice-row"
          key={r.id}
          to={"/invoices/" + r.id}
        >
          <div>
            <strong>{r.invoice?.number}</strong>
            <small>
              {state.patients.find((p) => p.id === r.patientId)?.name} ·{" "}
              {r.patientId}
            </small>
          </div>
          <div>
            <span>{r.invoice?.issueDate}</span>
            <small>Due {r.invoice?.dueDate}</small>
          </div>
          <div>
            <Badge>{invoiceStatus(state, r, date)}</Badge>
          </div>
          <span className="finance-number" data-label="Total">
            {inr(invoiceTotals(r.invoice!).total)}
          </span>
          <span className="finance-number" data-label="Net paid">
            {inr(invoicePaid(state, r.id, date))}
          </span>
          <strong className="finance-number" data-label="Balance">
            {inr(invoiceBalance(state, r, date))}
          </strong>
        </Link>
      ))}
      {!rows.length && <Empty>No invoices match the selected filters.</Empty>}
    </>
  );
}
export default function Billing({
  invoicesOnly = false,
}: {
  invoicesOnly?: boolean;
}) {
  const { state } = useFinanceSave(),
    [params] = useSearchParams(),
    navigate = useNavigate(),
    [from, setFrom] = useState(
      params.get("status") === "Pending"
        ? "2000-01-01"
        : params.get("date") || "2026-10-01",
    ),
    [to, setTo] = useState(params.get("date") || DEMO_DATE),
    [status, setStatus] = useState(
      params.get("status") === "Pending"
        ? "Outstanding"
        : params.get("status") || "All",
    ),
    [q, setQ] = useState(""),
    [tax, setTax] = useState(false);
  useEffect(() => {
    const id = params.get("record");
    if (id) navigate("/invoices/" + id, { replace: true });
  }, [params, navigate]);
  const summary = financeSummary(state, from, to, status),
    rows = summary.invoices
      .filter((r) =>
        (
          r.invoice?.number +
          " " +
          state.patients.find((p) => p.id === r.patientId)?.name +
          " " +
          r.patientId
        )
          .toLowerCase()
          .includes(q.toLowerCase()),
      )
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return (
    <div className="finance-page">
      <FinanceHeader
        title={invoicesOnly ? "Invoices" : "Packages & Billing"}
        description={
          invoicesOnly
            ? "Drafts, issued invoices and balances from the shared patient ledger."
            : "Issued charges, actual collections and patient package balances at a glance."
        }
        actions={
          <>
            <button className="button" onClick={() => setTax(true)}>
              Tax configuration
            </button>
            <Link className="button primary" to="/invoices/new">
              + Create invoice
            </Link>
          </>
        }
      />
      <div className="operations-filters card">
        <label>
          From date
          <input
            aria-label="Finance from date"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value || "2026-10-01")}
          />
        </label>
        <label>
          To date
          <input
            aria-label="Finance to date"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value || DEMO_DATE)}
          />
        </label>
        <label>
          Invoice status
          <select
            aria-label="Finance invoice status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {[
              "All",
              "Outstanding",
              "Draft",
              "Issued",
              "Partially paid",
              "Paid",
              "Overdue",
              "Void",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Search invoices
          <input
            aria-label="Search invoices"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Invoice, patient name or ID"
          />
        </label>
        <button
          className="button"
          onClick={() => {
            setFrom("2026-10-01");
            setTo(DEMO_DATE);
            setStatus("All");
            setQ("");
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
      <Metrics
        items={[
          ["Net collections", inr(summary.collections)],
          ["Invoices issued", inr(summary.billed)],
          ["Outstanding in period", inr(summary.outstanding)],
          ["Package sales before tax", inr(summary.packageSales)],
          ["Overdue invoices", summary.overdue],
          ["Draft projection (unbilled)", inr(summary.projected)],
        ]}
      />
      <p className="finance-caption">
        Invoice metrics use issue dates in this period; outstanding is
        calculated as of {to}. Collections use receipt/refund dates. Status
        filters limit collections to matching invoices; unallocated deposits
        appear with All statuses. Draft projections are not billed revenue or
        money collected.
      </p>
      <section className="card">
        <div className="operations-room">
          <h2>
            {invoicesOnly ? "Invoice library" : "Issued invoices & drafts"}
          </h2>
        </div>
        <InvoiceRows rows={rows} date={to} />
      </section>
      {!invoicesOnly && (
        <section className="card operations-room">
          <div className="operations-split">
            <h2>Recent transactions</h2>
            <Link className="text-link" to="/payments">
              View all payments
            </Link>
          </div>
          <p>
            Receipts {inr(summary.receipts)} · Refunds {inr(summary.refunds)} ·
            Net {inr(summary.collections)}
          </p>
          {summary.payments
            .slice()
            .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
            .slice(0, 12)
            .map((p) => (
              <div className="finance-transaction" key={p.id}>
                <Link className="text-link" to={"/patients/" + p.patientId}>
                  {p.name}
                  <small>
                    {p.date} · {p.payment?.method} · {p.payment?.kind}
                  </small>
                </Link>
                <span>
                  {p.payment?.invoiceId ? (
                    <Link
                      className="text-link"
                      to={"/invoices/" + p.payment.invoiceId}
                    >
                      Open invoice
                    </Link>
                  ) : (
                    "On-account deposit"
                  )}
                  <small>{p.payment?.reference}</small>
                </span>
                <strong className="finance-number">
                  {p.payment?.kind === "Refund" ? "−" : ""}
                  {inr(p.amount)}
                </strong>
              </div>
            ))}
          {!summary.payments.length && (
            <Empty>No transactions in this period.</Empty>
          )}
        </section>
      )}
      {tax && <TaxEditor onClose={() => setTax(false)} />}
    </div>
  );
}
