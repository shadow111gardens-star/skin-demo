import { useNavigate } from "react-router-dom";
import { safeDate } from "../services";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Plus,
  Download,
  ChevronRight,
  FileText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Badge, Modal } from "../components";
import { useClinic, addActivity } from "../store";
import { money, type RecordItem, type Patient } from "../data";
import { followupStatus, recordPayment } from "../services";
import { type Role } from "../auth";
import { type CreateKind, quickActions } from "../features/QuickCreate";
interface Props {
  page: string;
  role: Role;
  onCreate: (kind: CreateKind) => void;
  onPatient: (p: Patient) => void;
  onCourse: (id: string) => void;
}
const kinds: Record<string, CreateKind> = {
  "Skin Analysis": "scan",
  "Treatment Plans": "plan",
  "Sittings & Sessions": "session",
  Payments: "payment",
};
export default function RecordsPage({
  page,
  role,
  onCreate,
  onPatient,
  onCourse,
}: Props) {
  const { state, setState, notify } = useClinic();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [dialog, setDialog] = useState("");
  const [selected, setSelected] = useState<RecordItem | null>(null);
  const [error, setError] = useState("");
  const date = safeDate(params.get("date"));
  const search = params.get("q") || "";
  const status = params.get("status") || "All";
  const records = (state.records[page] || []).map((r) =>
    page === "Follow-ups"
      ? { ...r, status: followupStatus(r, date) }
      : page === "Machines & Equipment"
        ? {
            ...r,
            status: state.appointments.some(
              (a) =>
                a.machineId === r.id &&
                a.date === date &&
                a.status === "In progress",
            )
              ? "In use"
              : r.status === "In use"
                ? "Available"
                : r.status,
          }
        : r,
  );
  const rows = records.filter(
    (r) =>
      (status === "All" || r.status === status) &&
      `${r.name} ${r.detail}`.toLowerCase().includes(search.toLowerCase()) &&
      (!params.has("date") ||
        !["Payments", "Skin Analysis", "Sittings & Sessions"].includes(page) ||
        r.date === date),
  );
  const focused =
    selected || records.find((r) => r.id === params.get("record"));
  const patient = state.patients.find((p) => p.id === focused?.patientId);
  const createKind = kinds[page];
  const canCreate = createKind
    ? quickActions(role).some((q) => q.kind === createKind)
    : role === "Clinic Owner" ||
      (role === "Receptionist" &&
        [
          "Follow-ups",
          "Leads & Enquiries",
          "Clinical Documents",
          "Packages & Billing",
        ].includes(page)) ||
      (role === "Laser Technician" &&
        ["Inventory", "Maintenance"].includes(page));
  const canEdit =
    canCreate ||
    ((role === "Doctor" || role === "Laser Technician") &&
      page === "Sittings & Sessions") ||
    (role === "Doctor" && page === "Follow-ups");
  const change = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
  };
  const close = () => {
    setSelected(null);
    setDialog("");
    setError("");
    if (params.has("record")) {
      const next = new URLSearchParams(params);
      next.delete("record");
      setParams(next, { replace: true });
    }
  };
  function exportData() {
    const blob = new Blob([JSON.stringify(rows, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mmverse-${page.toLowerCase().replaceAll(" ", "-")}.json`;
    link.click();
    URL.revokeObjectURL(url);
    notify("Demo records exported");
  }
  function addRecord(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const patientId = String(f.get("patientId") || "");
    const p = state.patients.find((p) => p.id === patientId);
    const name = String(f.get("name") || "").trim();
    if (!name) {
      setError("Enter a record name.");
      return;
    }
    const r: RecordItem = {
      id: crypto.randomUUID(),
      name: p ? p.name : name,
      detail: String(f.get("detail")).trim(),
      patientId: patientId || undefined,
      amount: Number(f.get("amount") || 0),
      status:
        page === "Follow-ups"
          ? "Scheduled"
          : page === "Inventory"
            ? "In stock"
            : "Pending",
      date,
      dueDate: String(f.get("dueDate") || "") || undefined,
    };
    setState((s) =>
      addActivity(
        {
          ...s,
          records: { ...s.records, [page]: [r, ...(s.records[page] || [])] },
        },
        `${page} record created: ${r.name}.`,
      ),
    );
    notify("Record saved");
    close();
  }
  function update(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!focused) return;
    if (page === "Sittings & Sessions") {
      navigate("/sittings-sessions/" + focused.id);
      return;
    }
    const f = new FormData(e.currentTarget);
    const nextStatus =
      page === "Payments"
        ? "Received"
        : page === "Packages & Billing"
          ? "Paid"
          : page === "Integrations"
            ? "Simulated"
            : page === "Inventory"
              ? "In stock"
              : page === "Skin Analysis"
                ? "Reviewed"
                : page === "Treatment Plans"
                  ? "Completed"
                  : "Completed";
    if (
      page === "Packages & Billing" &&
      focused.status !== "Paid" &&
      focused.patientId
    ) {
      setState((s) =>
        addActivity(
          recordPayment(
            s,
            focused.patientId!,
            focused.amount,
            date,
            focused.id,
          ),
          `Invoice ${focused.name} marked paid with a simulated collection.`,
        ),
      );
    } else {
      setState((s) => {
        const updated = {
          ...s,
          records: {
            ...s.records,
            [page]: s.records[page].map((r) =>
              r.id === focused.id
                ? {
                    ...r,
                    status: nextStatus,
                    detail:
                      page === "Inventory"
                        ? `${Number(f.get("quantity"))} units · stock updated`
                        : page === "Sittings & Sessions"
                          ? `${r.detail} · Reviewed parameters: ${String(f.get("notes"))}`
                          : r.detail,
                  }
                : r,
            ),
          },
        };
        const finalState = updated;
        return addActivity(
          finalState,
          `${focused.name}: ${page.toLowerCase()} updated.`,
        );
      });
    }
    notify(
      page === "Integrations"
        ? "Simulated connection test complete"
        : "Record updated",
    );
    close();
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CONNECTED CLINIC WORKSPACE</div>
          <h1>{page}</h1>
          <p>
            {page === "Follow-ups"
              ? "Thoughtful check-ins, from treatment to recovery."
              : `Manage ${page.toLowerCase()} across your clinic.`}
          </p>
        </div>
        <div className="heading-actions">
          <button className="button secondary" onClick={exportData}>
            <Download size={15} />
            Export
          </button>
          {canCreate && (
            <button
              className="button primary"
              onClick={() =>
                createKind ? onCreate(createKind) : setDialog("create")
              }
            >
              <Plus size={16} />
              Add {createKind || "record"}
            </button>
          )}
        </div>
      </div>
      <section className="card">
        <div className="list-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              aria-label={`Search ${page}`}
              placeholder={`Search ${page.toLowerCase()}…`}
              value={search}
              onChange={(e) => change("q", e.target.value)}
            />
          </div>
          <select
            aria-label="Record status"
            value={status}
            onChange={(e) => change("status", e.target.value)}
          >
            {[
              ...new Set([
                "All",
                ...records.map((r) => r.status),
                ...(status !== "All" ? [status] : []),
              ]),
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {params.has("date") && (
            <input
              type="date"
              aria-label="Record date"
              value={date}
              onChange={(e) => {
                if (e.target.value) change("date", e.target.value);
              }}
            />
          )}
        </div>
        {["Skin Analysis", "Integrations", "Sittings & Sessions"].includes(
          page,
        ) && (
          <div className="info-strip">
            <ShieldCheck size={16} />
            {page === "Sittings & Sessions"
              ? "Clinician-approved parameters, relevant consent and review are required for treatment."
              : "Measurements, scans and connections are simulated. No AI diagnosis or live device connectivity."}
          </div>
        )}
        <div className="record-list">
          {rows.map((r) => (
            <button
              className="record-row"
              key={r.id}
              onClick={() => {
                setSelected(r);
                setDialog("detail");
              }}
            >
              <span className="record-icon">
                <FileText size={20} />
              </span>
              <span className="record-copy">
                <strong>{r.name}</strong>
                <small>{r.detail}</small>
                {r.dueDate && (
                  <small>
                    {page === "Packages & Billing" ? "Expires" : "Due"}{" "}
                    {r.dueDate}
                  </small>
                )}
              </span>
              {r.amount > 0 && <strong>{money(r.amount)}</strong>}
              <Badge>{r.status}</Badge>
              <ChevronRight size={17} />
            </button>
          ))}
          {!rows.length && (
            <div className="empty">
              <FileText size={25} />
              <h3>No matching records</h3>
              <p>Try a different status, date or search.</p>
              <button className="text-button" onClick={() => setParams({})}>
                Clear filters
              </button>
            </div>
          )}
        </div>
        <div className="list-count">
          {rows.length} records · fictional demo data
        </div>
      </section>
      {dialog === "create" && (
        <Modal title={`Add ${page.toLowerCase()} record`} onClose={close}>
          <form onSubmit={addRecord}>
            <label>
              Record name
              <input name="name" minLength={2} required autoFocus />
            </label>
            {[
              "Follow-ups",
              "Packages & Billing",
              "Clinical Documents",
            ].includes(page) && (
              <label>
                Patient
                <select name="patientId" required>
                  <option value="">Select patient</option>
                  {state.patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Details
              <textarea name="detail" minLength={3} required />
            </label>
            {["Follow-ups", "Maintenance", "Packages & Billing"].includes(
              page,
            ) && (
              <label>
                {page === "Packages & Billing" ? "Package expiry" : "Due date"}
                <input
                  type="date"
                  name="dueDate"
                  defaultValue={date}
                  required
                />
              </label>
            )}
            {page === "Packages & Billing" && (
              <label>
                Amount (INR)
                <input type="number" name="amount" min="1" required />
              </label>
            )}
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                onClick={close}
              >
                Cancel
              </button>
              <button className="button primary">Save record</button>
            </div>
          </form>
        </Modal>
      )}
      {focused && dialog !== "create" && (
        <Modal
          title={
            dialog === "delete"
              ? "Delete demo record"
              : page === "Treatment Plans"
                ? "Treatment course"
                : "Record details"
          }
          onClose={close}
        >
          {dialog === "delete" ? (
            <>
              <p>
                Permanently delete “{focused.name}” from the local demo? This
                cannot be undone.
              </p>
              <div className="form-actions">
                <button
                  className="button secondary"
                  onClick={() => setDialog("detail")}
                >
                  Keep record
                </button>
                <button
                  className="button danger"
                  onClick={() => {
                    setState((s) =>
                      addActivity(
                        {
                          ...s,
                          records: {
                            ...s.records,
                            [page]: s.records[page].filter(
                              (r) => r.id !== focused.id,
                            ),
                          },
                        },
                        `Demo ${page.toLowerCase()} record deleted.`,
                      ),
                    );
                    notify("Record deleted");
                    close();
                  }}
                >
                  Delete record
                </button>
              </div>
            </>
          ) : (
            <>
              <h3>{focused.name}</h3>
              <p className="muted">{focused.detail}</p>
              <Badge>{focused.status}</Badge>
              {focused.amount > 0 && <h2>{money(focused.amount)}</h2>}
              {patient && (
                <button
                  className="course-link"
                  onClick={() => {
                    close();
                    onPatient(patient);
                  }}
                >
                  <Users size={17} />
                  {patient.name} · {patient.id}
                  <ChevronRight size={15} />
                </button>
              )}
              {page === "Treatment Plans" && (
                <button
                  className="button secondary"
                  onClick={() => {
                    const id = focused.id;
                    close();
                    onCourse(id);
                  }}
                >
                  View course sittings
                </button>
              )}
              {canEdit && (
                <form onSubmit={update}>
                  {page === "Inventory" && (
                    <label>
                      Stock quantity
                      <input
                        name="quantity"
                        type="number"
                        min="0"
                        required
                        defaultValue="25"
                      />
                    </label>
                  )}
                  {page === "Sittings & Sessions" && (
                    <>
                      <label>
                        Clinician-approved settings and session notes
                        <textarea name="notes" minLength={5} required />
                      </label>
                      <label className="checkbox">
                        <input type="checkbox" required /> Relevant consent
                        recorded
                      </label>
                      <label className="checkbox">
                        <input type="checkbox" required /> Treating clinician
                        has reviewed the session
                      </label>
                    </>
                  )}
                  {page === "Skin Analysis" && (
                    <label className="checkbox">
                      <input type="checkbox" required /> Assessment reviewed by
                      treating clinician
                    </label>
                  )}
                  <div className="form-actions">
                    {role === "Clinic Owner" &&
                      !["Payments", "Packages & Billing"].includes(page) && (
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => setDialog("delete")}
                        >
                          Delete
                        </button>
                      )}
                    {!["Completed", "Received", "Paid", "Reviewed"].includes(
                      focused.status,
                    ) && (
                      <button className="button primary">
                        {page === "Inventory"
                          ? "Update stock"
                          : page === "Integrations"
                            ? "Test simulated connection"
                            : page === "Packages & Billing"
                              ? "Record full demo payment"
                              : page === "Skin Analysis"
                                ? "Mark reviewed"
                                : "Mark completed"}
                      </button>
                    )}
                  </div>
                </form>
              )}
            </>
          )}
        </Modal>
      )}
    </>
  );
}
