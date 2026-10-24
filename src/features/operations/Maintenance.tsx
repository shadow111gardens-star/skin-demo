import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Badge } from "../../components";
import { DEMO_DATE, type RecordItem } from "../../data";
import {
  OperationHeader,
  Metrics,
  OperationForm,
  Empty,
  useOperation,
  actor,
  options,
  type Field,
} from "./OperationsUI";
import { saveMaintenance } from "./services";
export function MaintenanceEditor({
  record,
  machineId,
  onClose,
}: {
  record?: RecordItem;
  machineId?: string;
  onClose: () => void;
}) {
  const { state, commit } = useOperation(),
    d = record?.maintenance;
  const fields: Field[] = [
    { key: "name", label: "Task name", required: true },
    {
      key: "machineId",
      label: "Machine",
      required: true,
      options: [
        { value: "", label: "Select machine" },
        ...state.records["Machines & Equipment"].map((m) => ({
          value: m.id,
          label: m.name,
        })),
      ],
    },
    { key: "dueDate", label: "Due date", type: "date", required: true },
    {
      key: "severity",
      label: "Severity",
      options: options(["Routine", "Priority", "Critical"]),
    },
    { key: "assignedTo", label: "Assigned staff member", required: true },
    { key: "notes", label: "Task notes", type: "textarea", required: true },
    {
      key: "status",
      label: "Task status",
      options: options([
        "Scheduled",
        "In Progress",
        "Awaiting Clearance",
        "Completed",
        "Cancelled",
      ]),
    },
    {
      key: "serviceDate",
      label: "Service date (required for completion)",
      type: "date",
    },
    {
      key: "serviceNotes",
      label: "Service / clearance notes (required for completion)",
      type: "textarea",
    },
    {
      key: "restore",
      label: "Availability after completion",
      options: [
        { value: "no", label: "Keep current availability" },
        { value: "yes", label: "Restore after all tasks cleared" },
      ],
    },
  ];
  return (
    <OperationForm
      title={record ? "Update maintenance task" : "Create maintenance task"}
      fields={fields}
      initial={{
        name: record?.name || "",
        machineId: record?.machineId || machineId || "",
        dueDate: record?.dueDate || DEMO_DATE,
        severity: d?.severity || "Routine",
        assignedTo: d?.assignedTo || "",
        notes: d?.notes || "",
        status: record?.status || "Scheduled",
        serviceDate: d?.serviceDate || "",
        serviceNotes: d?.serviceNotes || "",
        restore: "no",
      }}
      confirmation="I confirm this change. In Progress and Awaiting Clearance block new bookings; restoration requires documented clearance."
      onClose={onClose}
      onSave={(v, c) =>
        commit(
          (s) =>
            saveMaintenance(
              s,
              {
                ...record,
                id: record?.id || "maintenance-" + crypto.randomUUID(),
                name: v.name,
                machineId: v.machineId,
                dueDate: v.dueDate,
                date: DEMO_DATE,
                status: v.status,
                detail: v.notes,
                amount: 0,
                maintenance: {
                  ...d,
                  severity: v.severity as "Routine" | "Priority" | "Critical",
                  assignedTo: v.assignedTo,
                  notes: v.notes,
                  serviceDate: v.serviceDate,
                  serviceNotes: v.serviceNotes,
                  events: d?.events || [],
                },
              },
              actor,
              c,
              v.restore === "yes",
            ),
          "Maintenance record saved",
        )
      }
    />
  );
}
export default function Maintenance() {
  const { state } = useOperation(),
    [params, setParams] = useSearchParams();
  const [edit, setEdit] = useState<RecordItem | null | undefined>(),
    [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [machine, setMachine] = useState(params.get("machine") || ""),
    [severity, setSeverity] = useState("");
  useEffect(() => {
    const id = params.get("task"),
      r = state.records.Maintenance.find((r) => r.id === id);
    if (r && !["Completed", "Cancelled"].includes(r.status)) setEdit(r);
  }, [params, state.records.Maintenance]);
  const closeEditor = () => {
    setEdit(undefined);
    if (params.get("task")) {
      const next = new URLSearchParams(params);
      next.delete("task");
      setParams(next, { replace: true });
    }
  };
  const tasks = state.records["Maintenance"],
    rows = tasks
      .filter(
        (t) =>
          (
            t.name +
            " " +
            t.maintenance?.assignedTo +
            " " +
            t.maintenance?.notes
          )
            .toLowerCase()
            .includes(q.toLowerCase()) &&
          (!status || t.status === status) &&
          (!machine || t.machineId === machine) &&
          (!severity || t.maintenance?.severity === severity),
      )
      .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  return (
    <div className="operations-page">
      <OperationHeader
        title="Maintenance"
        description="Plan service, retain clearance records and control asset availability."
        action={
          <button className="button primary" onClick={() => setEdit(null)}>
            + Create maintenance task
          </button>
        }
      />
      <Metrics
        items={[
          [
            "Open tasks",
            tasks.filter((t) => !["Completed", "Cancelled"].includes(t.status))
              .length,
          ],
          [
            "Clearance pending",
            tasks.filter((t) =>
              ["In Progress", "Awaiting Clearance"].includes(t.status),
            ).length,
          ],
          [
            "Due / overdue",
            tasks.filter(
              (t) =>
                (t.dueDate || "9999") <= DEMO_DATE &&
                !["Completed", "Cancelled"].includes(t.status),
            ).length,
          ],
          [
            "Completed services",
            tasks.filter((t) => t.status === "Completed").length,
          ],
        ]}
      />
      <section className="card">
        <div className="operations-filters">
          <label>
            Search
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Task, employee or notes"
            />
          </label>
          <label>
            Status
            <select
              aria-label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {[
                "Scheduled",
                "In Progress",
                "Awaiting Clearance",
                "Completed",
                "Cancelled",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Machine
            <select
              aria-label="Machine"
              value={machine}
              onChange={(e) => setMachine(e.target.value)}
            >
              <option value="">All machines</option>
              {state.records["Machines & Equipment"].map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Severity
            <select
              aria-label="Severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              <option value="">All priorities</option>
              {["Routine", "Priority", "Critical"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <button
            className="button"
            onClick={() => {
              setQ("");
              setStatus("");
              setMachine("");
              setSeverity("");
            }}
          >
            Reset
          </button>
        </div>
        {rows.map((t) => (
          <article className="operations-row maintenance-row" key={t.id}>
            <div>
              <strong>{t.name}</strong>
              <Link
                className="text-link"
                to={"/machines-equipment/" + t.machineId}
              >
                {
                  state.records["Machines & Equipment"].find(
                    (m) => m.id === t.machineId,
                  )?.name
                }
              </Link>
              <small>{t.maintenance?.notes}</small>
            </div>
            <div>
              <Badge>{t.status}</Badge>
              <small>
                {t.maintenance?.severity} · {t.maintenance?.assignedTo}
              </small>
            </div>
            <div>
              <span>Due {t.dueDate}</span>
              <small>
                {t.maintenance?.serviceDate
                  ? "Serviced " + t.maintenance.serviceDate
                  : "Service not yet recorded"}
              </small>
              <small>{t.maintenance?.serviceNotes}</small>
            </div>
            <div>
              {!["Completed", "Cancelled"].includes(t.status) ? (
                <button className="button" onClick={() => setEdit(t)}>
                  Update / clear
                </button>
              ) : (
                <span className="muted">Retained service record</span>
              )}
            </div>
          </article>
        ))}
        {!rows.length && (
          <Empty>
            No maintenance tasks match. Create a task or reset filters.
          </Empty>
        )}
      </section>
      {edit !== undefined && (
        <MaintenanceEditor record={edit || undefined} onClose={closeEditor} />
      )}
    </div>
  );
}
