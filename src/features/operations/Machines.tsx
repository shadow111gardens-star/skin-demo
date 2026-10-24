import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "../../components";
import { DEMO_DATE, type RecordItem } from "../../data";
import {
  OperationHeader,
  Metrics,
  OperationForm,
  Empty,
  options,
  useOperation,
  actor,
  type Field,
} from "./OperationsUI";
import { machineStatuses, type MachineStatus } from "./model";
import { compatibleTreatments, machineStatus, roomFor } from "./selectors";
import { saveMachine, changeMachineStatus } from "./services";
export function MachineEditor({
  record,
  onClose,
}: {
  record?: RecordItem;
  onClose: () => void;
}) {
  const { state, commit } = useOperation();
  const [selected, setSelected] = useState(
    compatibleTreatments(state, record?.id || "").map((t) => t.id),
  );
  const m = record?.machine;
  const fields: Field[] = [
    { key: "name", label: "Machine name", required: true },
    { key: "brand", label: "Brand", required: true },
    { key: "model", label: "Model", required: true },
    { key: "serial", label: "Serial number", required: true },
    { key: "category", label: "Category", required: true },
    {
      key: "roomId",
      label: "Assigned room",
      required: true,
      options: [
        { value: "", label: "Select room" },
        ...state.records["Rooms & Resources"].map((r) => ({
          value: r.id,
          label: r.room!.code + " · " + r.name,
        })),
      ],
    },
    { key: "lastService", label: "Last service", type: "date" },
    { key: "nextMaintenance", label: "Next maintenance", type: "date" },
    {
      key: "planningMinutes",
      label: "Daily planning capacity (minutes)",
      type: "number",
      required: true,
      help: "Clinic planning denominator, not machine runtime.",
    },
  ];
  return (
    <OperationForm
      title={record ? "Edit machine" : "Create machine"}
      fields={fields}
      initial={{
        name: record?.name || "",
        brand: m?.brand || "",
        model: m?.model || "",
        serial: m?.serial || "",
        category: m?.category || "",
        roomId: m?.roomId || "",
        lastService: m?.lastService || "",
        nextMaintenance: m?.nextMaintenance || "",
        planningMinutes: String(m?.planningMinutes || 480),
      }}
      onClose={onClose}
      onSave={(v) =>
        commit(
          (s) =>
            saveMachine(
              s,
              {
                ...record,
                id: record?.id || "machine-" + crypto.randomUUID(),
                name: v.name,
                detail: "Manually registered demo asset",
                amount: 0,
                status: record?.status || "Available",
                machine: {
                  brand: v.brand,
                  model: v.model,
                  serial: v.serial,
                  category: v.category,
                  roomId: v.roomId,
                  lastService: v.lastService,
                  nextMaintenance: v.nextMaintenance,
                  planningMinutes: Number(v.planningMinutes),
                  events: m?.events || [],
                  documents: m?.documents || [],
                },
              },
              selected,
              actor,
            ),
          "Machine saved",
        )
      }
    >
      <fieldset className="operations-checks">
        <legend>Clinic-configured compatible treatments</legend>
        {state.records["Treatment Catalogue"]
          .filter((t) => t.treatment)
          .map((t) => (
            <label key={t.id}>
              <input
                type="checkbox"
                checked={selected.includes(t.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, t.id]
                      : selected.filter((id) => id !== t.id),
                  )
                }
              />
              {t.name}
            </label>
          ))}
      </fieldset>
    </OperationForm>
  );
}
export function MachineStatusForm({
  record,
  onClose,
}: {
  record: RecordItem;
  onClose: () => void;
}) {
  const { state, commit } = useOperation();
  return (
    <OperationForm
      title="Change machine status"
      fields={[
        {
          key: "status",
          label: "Machine status",
          required: true,
          options: options(machineStatuses),
        },
        {
          key: "note",
          label: "Reason / clearance reference",
          required: true,
          type: "textarea",
        },
      ]}
      initial={{ status: machineStatus(state, record), note: "" }}
      confirmation="I confirm this availability change. Under-maintenance machines stay blocked until service clearance."
      onClose={onClose}
      onSave={(v, c) =>
        commit(
          (s) =>
            changeMachineStatus(
              s,
              record.id,
              v.status as MachineStatus,
              v.note,
              actor,
              c,
            ),
          "Machine availability updated",
        )
      }
    />
  );
}
export default function Machines() {
  const { state } = useOperation(),
    navigate = useNavigate(),
    [params] = useSearchParams();
  const [q, setQ] = useState(""),
    [status, setStatus] = useState(params.get("status") || ""),
    [room, setRoom] = useState(""),
    [treatment, setTreatment] = useState(""),
    [sort, setSort] = useState("name"),
    [edit, setEdit] = useState<RecordItem | null | undefined>(),
    [changing, setChanging] = useState<RecordItem>();
  const machines = state.records["Machines & Equipment"];
  useEffect(() => {
    const id = params.get("record");
    if (id)
      navigate("/machines-equipment/" + encodeURIComponent(id), {
        replace: true,
      });
  }, [params, navigate]);
  const rows = machines
    .filter(
      (m) =>
        (
          m.name +
          " " +
          m.machine?.brand +
          " " +
          m.machine?.model +
          " " +
          m.machine?.serial
        )
          .toLowerCase()
          .includes(q.toLowerCase()) &&
        (!status || machineStatus(state, m) === status) &&
        (!room || m.machine?.roomId === room) &&
        (!treatment ||
          compatibleTreatments(state, m.id).some((t) => t.id === treatment)),
    )
    .sort((a, b) =>
      sort === "service"
        ? (a.machine?.nextMaintenance || "9999").localeCompare(
            b.machine?.nextMaintenance || "9999",
          )
        : sort === "status"
          ? machineStatus(state, a).localeCompare(machineStatus(state, b))
          : a.name.localeCompare(b.name),
    );
  return (
    <div className="operations-page">
      <OperationHeader
        title="Machines & Equipment"
        description="A clear view of your clinic's equipment and service readiness."
        action={
          <button className="button primary" onClick={() => setEdit(null)}>
            + Add machine
          </button>
        }
      />
      <Metrics
        items={[
          ["Registered assets", machines.length],
          [
            "Available",
            machines.filter((m) => machineStatus(state, m) === "Available")
              .length,
          ],
          [
            "Under maintenance",
            machines.filter(
              (m) => machineStatus(state, m) === "Under Maintenance",
            ).length,
          ],
          [
            "Service due today",
            machines.filter(
              (m) => (m.machine?.nextMaintenance || "9999") <= DEMO_DATE,
            ).length,
          ],
        ]}
      />
      <section className="card">
        <div className="operations-filters">
          <label>
            Search machines
            <input
              placeholder="Name, brand, model or serial"
              value={q}
              onChange={(e) => setQ(e.target.value)}
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
              {machineStatuses.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Treatment
            <select
              aria-label="Treatment"
              value={treatment}
              onChange={(e) => setTreatment(e.target.value)}
            >
              <option value="">All treatments</option>
              {state.records["Treatment Catalogue"].map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Room
            <select
              aria-label="Room"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            >
              <option value="">All rooms</option>
              {state.records["Rooms & Resources"].map((r) => (
                <option key={r.id} value={r.id}>
                  {r.room?.code}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sort
            <select
              aria-label="Sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="name">Name</option>
              <option value="service">Next service</option>
              <option value="status">Status</option>
            </select>
          </label>
          <button
            className="button"
            onClick={() => {
              setQ("");
              setStatus("");
              setRoom("");
              setTreatment("");
              setSort("name");
            }}
          >
            Reset
          </button>
        </div>
        <div className="operations-table">
          <div className="operations-row operations-table-head">
            <span>Machine / asset</span>
            <span>Compatibility / room</span>
            <span>Availability</span>
            <span>Service dates</span>
            <span>Actions</span>
          </div>
          {rows.map((m) => (
            <article className="operations-row" key={m.id}>
              <div>
                <button
                  className="text-link"
                  onClick={() => navigate("/machines-equipment/" + m.id)}
                >
                  {m.name}
                </button>
                <small>
                  {m.machine?.brand} · {m.machine?.model}
                </small>
                <small>
                  {m.machine?.serial} · {m.machine?.category}
                </small>
              </div>
              <div>
                <span>
                  {compatibleTreatments(state, m.id)
                    .map((t) => t.name)
                    .join(", ") || "No treatment mapping configured"}
                </span>
                <small>{roomFor(state, m.machine!.roomId)?.room?.code}</small>
              </div>
              <div>
                <Badge>{machineStatus(state, m)}</Badge>
              </div>
              <div>
                <small>Last: {m.machine?.lastService || "Not recorded"}</small>
                <small>
                  Next: {m.machine?.nextMaintenance || "Not scheduled"}
                </small>
              </div>
              <div className="operations-actions">
                <button
                  className="button"
                  onClick={() => navigate("/machines-equipment/" + m.id)}
                >
                  Details
                </button>
                <button className="button" onClick={() => setEdit(m)}>
                  Edit
                </button>
                <button className="button" onClick={() => setChanging(m)}>
                  Set status
                </button>
              </div>
            </article>
          ))}
          {!rows.length && (
            <Empty>
              No machines match these filters. Reset filters or register an
              asset.
            </Empty>
          )}
        </div>
      </section>
      {edit !== undefined && (
        <MachineEditor
          record={edit || undefined}
          onClose={() => setEdit(undefined)}
        />
      )}
      {changing && (
        <MachineStatusForm
          record={changing}
          onClose={() => setChanging(undefined)}
        />
      )}
    </div>
  );
}
