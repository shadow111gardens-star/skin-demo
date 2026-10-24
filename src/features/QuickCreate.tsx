import PaymentForm from "./finance/PaymentForm";
import AppointmentForm from "./scheduling/AppointmentForm";
import SessionEntry from "./sessions/SessionEntry";
import { useState, useRef, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { Modal } from "../components";
import { useClinic, addActivity } from "../store";
import { DEMO_DATE, money, type Patient, type RecordItem } from "../data";
import { canBill, canBook, canClinical, type Role } from "../auth";
import { recordPayment, addDays } from "../services";
import PatientForm from "./patients/PatientForm";
import ScanWizard from "./scans/ScanWizard";
import { ConsultationForm } from "./clinical/Consultations";
import PlanBuilder from "./clinical/PlanBuilder";
export type CreateKind =
  | "patient"
  | "appointment"
  | "scan"
  | "plan"
  | "session"
  | "payment"
  | "consultation"
  | "followup";
export function quickActions(role: Role) {
  return [
    {
      kind: "patient" as const,
      label: "New patient",
      detail: "Start a connected care journey",
      allowed: canBook(role),
    },
    {
      kind: "appointment" as const,
      label: "Book appointment",
      detail: "Reserve time with your care team",
      allowed: canBook(role),
    },
    {
      kind: "scan" as const,
      label: "Skin scan",
      detail: "Create a simulated assessment",
      allowed: canClinical(role),
    },
    {
      kind: "plan" as const,
      label: "Treatment plan",
      detail: "Record a clinician-approved course",
      allowed: role === "Clinic Owner" || role === "Doctor",
    },
    {
      kind: "session" as const,
      label: "New session",
      detail: "Prepare an appointment sitting",
      allowed: canClinical(role),
    },
    {
      kind: "payment" as const,
      label: "Record payment",
      detail: "Add a simulated collection",
      allowed: canBill(role),
    },
    {
      kind: "consultation" as const,
      label: "Start consultation",
      detail: "Open a patient-linked clinical record",
      allowed: role === "Clinic Owner" || role === "Doctor",
    },
    {
      kind: "followup" as const,
      label: "Schedule follow-up",
      detail: "Plan a check-in; no message is sent",
      allowed: canBook(role),
    },
  ].filter((a) => a.allowed);
}
interface Props {
  kind: CreateKind;
  onClose: () => void;
  date?: string;
  initialPatientId?: string;
  initialCourseId?: string;
  initialInvoiceId?: string;
  onSavedClinical?: (r: RecordItem, kind: "consultation" | "plan") => void;
  onSavedPatient?: (p: Patient) => void;
  onSavedScan?: (r: RecordItem, review: boolean) => void;
  onOpenSession?: (r: RecordItem) => void;
  onExisting?: (p: Patient) => void;
}
export default function QuickCreate(props: Props) {
  const cancel = useRef<(() => void) | null>(null);
  if (props.kind === "payment")
    return (
      <PaymentForm
        title="Record demo payment"
        patientId={props.initialPatientId}
        courseId={props.initialCourseId}
        invoiceId={props.initialInvoiceId}
        onClose={props.onClose}
      />
    );
  if (props.kind === "appointment")
    return (
      <AppointmentForm
        initialPatientId={props.initialPatientId}
        initialCourseId={props.initialCourseId}
        date={props.date}
        onClose={props.onClose}
      />
    );
  if (props.kind === "session")
    return (
      <SessionEntry
        initialCourseId={props.initialCourseId}
        initialPatientId={props.initialPatientId}
        onClose={props.onClose}
        onOpen={props.onOpenSession}
      />
    );
  if (props.kind === "plan" || props.kind === "consultation") {
    const kind = props.kind;
    const common = {
      requestCancelRef: cancel,
      initialPatientId: props.initialPatientId,
      onClose: props.onClose,
      onSaved: (r: RecordItem) => {
        props.onClose();
        props.onSavedClinical?.(r, kind);
      },
    };
    return (
      <Modal
        title={kind === "plan" ? "Create treatment plan" : "Start consultation"}
        className="clinical-quick-modal"
        onClose={() => {
          if (cancel.current) cancel.current();
          else props.onClose();
        }}
      >
        {kind === "plan" ? (
          <PlanBuilder {...common} />
        ) : (
          <ConsultationForm {...common} />
        )}
      </Modal>
    );
  }
  if (props.kind === "scan")
    return (
      <Modal
        title="Create skin scan"
        className="scan-wizard-modal"
        onClose={() => {
          if (cancel.current) cancel.current();
          else props.onClose();
        }}
      >
        <ScanWizard
          requestCancelRef={cancel}
          initialPatientId={props.initialPatientId}
          date={props.date}
          onClose={props.onClose}
          onSaved={(r, review) => {
            props.onClose();
            props.onSavedScan?.(r, review);
          }}
        />
      </Modal>
    );
  return props.kind === "patient" ? (
    <PatientForm
      onClose={props.onClose}
      onSaved={props.onSavedPatient}
      onExisting={props.onExisting}
    />
  ) : (
    <WorkflowForm {...props} kind={props.kind} />
  );
}
function WorkflowForm({
  kind,
  onClose,
  date = DEMO_DATE,
  initialPatientId,
  initialCourseId,
}: Props & {
  kind: Exclude<
    CreateKind,
    "patient" | "scan" | "plan" | "consultation" | "session" | "appointment"
  >;
}) {
  const { state, setState, notify } = useClinic();
  const [patientId, setPatientId] = useState(
    initialPatientId || state.patients[0]?.id || "",
  );
  const [invoiceId, setInvoiceId] = useState(
    initialPatientId
      ? state.records["Packages & Billing"].find(
          (r) => r.patientId === initialPatientId && r.status !== "Paid",
        )?.id || ""
      : "",
  );
  const [error, setError] = useState("");
  const patient = state.patients.find((p) => p.id === patientId);
  const invoices = state.records["Packages & Billing"].filter(
    (r) => r.patientId === patientId && r.status !== "Paid",
  );
  const invoice = invoices.find((r) => r.id === invoiceId);
  const titles = {
    payment: "Record demo payment",
    followup: "Schedule follow-up",
  };
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError("");
    if (!patient) {
      setError("Select a registered patient.");
      return;
    }
    if (patient.status === "Archived") {
      setError("Restore this patient record before adding new care records.");
      return;
    }
    const id = crypto.randomUUID();
    const recordDate = String(f.get("date") || date);
    if (kind === "payment") {
      const amount = invoice?.amount || Number(f.get("amount"));
      if (!Number.isFinite(amount) || amount <= 0) {
        setError("Enter an amount greater than zero.");
        return;
      }
      setState((s) =>
        addActivity(
          recordPayment(s, patientId, amount, recordDate, invoiceId),
          `${money(amount)} demo payment recorded for ${patient.name}.`,
          patientId,
        ),
      );
    } else {
      const dueDate = String(f.get("dueDate") || "");
      const r: RecordItem = {
        id,
        name: patient.name,
        patientId,
        date: recordDate,
        amount: 0,
        courseId: initialCourseId,
        dueDate,
        status:
          dueDate < date
            ? "Overdue"
            : dueDate === date
              ? "Due today"
              : "Scheduled",
        detail:
          String(f.get("notes")) +
          " | " +
          String(f.get("channel")) +
          " | no message sent",
      };
      setState((s) =>
        addActivity(
          {
            ...s,
            records: {
              ...s.records,
              "Follow-ups": [r, ...s.records["Follow-ups"]],
            },
          },
          "Follow-up recorded for " + patient.name,
          patientId,
        ),
      );
    }
    notify(
      kind === "payment"
        ? "Demo payment recorded; no money was transferred"
        : kind === "followup"
          ? "Follow-up scheduled; no message was sent"
          : `${titles[kind]} saved`,
    );
    onClose();
  }
  return (
    <Modal
      title={titles[kind]}
      className="patient-workflow-modal"
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <label>
          Patient
          <select
            aria-label="Patient"
            value={patientId}
            required
            disabled={!!initialPatientId}
            onChange={(e) => {
              setPatientId(e.target.value);
              setInvoiceId("");
            }}
          >
            <option value="" disabled>
              Select a patient
            </option>
            {state.patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.id}
              </option>
            ))}
          </select>
          {initialPatientId && (
            <small>
              Linked to this patient’s existing record · {patientId}
            </small>
          )}
        </label>
        <label>
          Record date
          <input name="date" type="date" defaultValue={date} required />
        </label>
        {kind === "followup" && (
          <>
            <label>
              Follow-up date
              <input
                name="dueDate"
                type="date"
                defaultValue={addDays(date, 2)}
                required
              />
            </label>
            <label>
              Follow-up reason
              <textarea
                name="notes"
                required
                minLength={5}
                placeholder="e.g. Post-treatment recovery check"
              />
            </label>
            <label>
              Preferred channel
              <select
                name="channel"
                defaultValue={patient?.communicationPreference || "Phone"}
              >
                {["Phone", "WhatsApp", "SMS", "Email", "Do not contact"].map(
                  (c) => (
                    <option key={c}>{c}</option>
                  ),
                )}
              </select>
            </label>
            <div className="info-strip">
              Scheduling only. No message or call is sent; respect the patient’s
              recorded communication consent.
            </div>
          </>
        )}
        {kind === "payment" && (
          <>
            <label>
              Invoice
              <select
                aria-label="Invoice"
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
              >
                <option value="">On-account payment</option>
                {invoices.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {money(r.amount)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Amount (INR)
              {invoice ? (
                <input
                  aria-label="Invoice amount"
                  value={invoice.amount}
                  readOnly
                />
              ) : (
                <input
                  name="amount"
                  type="number"
                  min="1"
                  step="0.01"
                  required
                />
              )}
            </label>
            <label className="checkbox">
              <input type="checkbox" required />I understand this records a
              simulated payment only
            </label>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button primary">
            <Plus size={15} />
            {kind === "payment" ? "Save demo payment" : "Save record"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
