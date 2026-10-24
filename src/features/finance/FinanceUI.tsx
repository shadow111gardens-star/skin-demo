import { Modal, PageHeader } from "../../components";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useClinic } from "../../store";
import type { ClinicState } from "../../data";
import { inr, invoiceTotals } from "./ledger";
import type { InvoiceData } from "./model";
export function FinanceHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} eyebrow="CLINIC FINANCE" description={description} actions={actions} />
      <div className="finance-notice">
        Fictional INR ledger · saved in this browser. No payment gateway, bank
        transfer or external delivery.
      </div>
      <nav className="operations-links" aria-label="Finance navigation">
        {[
          ["/packages-billing", "Billing overview"],
          ["/packages", "Package catalogue"],
          ["/invoices", "Invoices"],
          ["/payments", "Payments"],
        ].map(([to, label]) => (
          <Link aria-label={"Finance: " + label} to={to} key={to}>
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
export function useFinanceSave() {
  const { state, setState, notify } = useClinic(),
    [error, setError] = useState("");
  return {
    state,
    error,
    setError,
    save: (update: (s: ClinicState) => ClinicState, message: string) => {
      try {
        const next = update(state);
        setState(next);
        setError("");
        notify(message);
        return true;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unable to save";
        setError(message);
        notify(message, "error");
        return false;
      }
    },
  };
}
export function Totals({
  invoice,
  paid = 0,
}: {
  invoice: InvoiceData;
  paid?: number;
}) {
  const t = invoiceTotals(invoice);
  return (
    <dl className="finance-totals">
      {[
        ["Line value", t.gross],
        ["Line discounts", -t.lineDiscount],
        ["Subtotal", t.subtotal],
        ["Invoice discount", -t.discount],
        ...t.taxes.map((t) => [t.name + " (" + t.rate + "%)", t.amount]),
        ["Total", t.total],
        ["Net paid", paid],
        [
          "Balance due",
          invoice.state === "Issued" ? Math.max(0, t.total - paid) : 0,
        ],
      ].map(([label, value]) => (
        <div
          key={String(label)}
          className={
            ["Total", "Balance due"].includes(String(label)) ? "total" : ""
          }
        >
          <dt>{label}</dt>
          <dd>{inr(Number(value))}</dd>
        </div>
      ))}
    </dl>
  );
}
export function FinanceError({ error }: { error: string }) {
  return error ? (
    <p role="alert" className="form-error">
      {error}
    </p>
  ) : null;
}

export function FinanceDiscard({
  onKeep,
  onDiscard,
}: {
  onKeep: () => void;
  onDiscard: () => void;
}) {
  return (
    <Modal title="Discard unsaved finance changes?" onClose={onKeep}>
      <p>The saved ledger will stay unchanged.</p>
      <div className="modal-actions">
        <button className="button" onClick={onKeep}>
          Keep editing
        </button>
        <button className="button danger" onClick={onDiscard}>
          Discard changes
        </button>
      </div>
    </Modal>
  );
}
