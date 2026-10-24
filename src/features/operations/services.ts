import { DEMO_DATE, type ClinicState, type RecordItem } from "../../data";
import { safeDate } from "../../services";
import { addActivity } from "../../store";
import {
  activeMaintenance,
  machineStatuses,
  type ResourceEvent,
  type MachineStatus,
  type StockMovement,
} from "./model";
import { roomFor, stockStatus } from "./selectors";
const event = (
  actor: string,
  action: string,
  note: string,
  status?: string,
): ResourceEvent => ({
  id: crypto.randomUUID(),
  at: new Date().toISOString(),
  actor,
  action,
  note,
  status,
});
const upsert = (s: ClinicState, key: string, r: RecordItem): ClinicState => ({
  ...s,
  records: {
    ...s.records,
    [key]: s.records[key]?.some((v) => v.id === r.id)
      ? s.records[key].map((v) => (v.id === r.id ? r : v))
      : [r, ...(s.records[key] || [])],
  },
});
const validDate = (v: string) => !!v && safeDate(v) === v;
function assertIdle(s: ClinicState, id: string) {
  if (
    s.records["Sittings & Sessions"].some(
      (r) => r.session?.machineId === id && r.status === "In Progress",
    )
  )
    throw new Error(
      "This machine has an in-progress sitting. Request clinician review before taking it out of service.",
    );
}
export function saveMachine(
  s: ClinicState,
  r: RecordItem,
  treatmentIds: string[],
  actor: string,
) {
  const d = r.machine,
    old = s.records["Machines & Equipment"].find((m) => m.id === r.id);
  if (
    !d ||
    !r.name.trim() ||
    !d.brand.trim() ||
    !d.model.trim() ||
    !d.serial.trim() ||
    !d.category.trim()
  )
    throw new Error("Enter machine name, brand, model, serial and category.");
  if (!roomFor(s, d.roomId)) throw new Error("Select a registered room.");
  if (
    s.records["Machines & Equipment"].some(
      (m) =>
        m.id !== r.id &&
        m.machine?.serial.toLowerCase() === d.serial.toLowerCase(),
    )
  )
    throw new Error("This serial number already belongs to another machine.");
  if (
    !Number.isInteger(d.planningMinutes) ||
    d.planningMinutes < 1 ||
    d.planningMinutes > 1440
  )
    throw new Error("Planning capacity must be 1–1440 minutes per day.");
  if (
    (d.lastService && !validDate(d.lastService)) ||
    (d.nextMaintenance && !validDate(d.nextMaintenance))
  )
    throw new Error("Enter valid service dates.");
  if (
    d.documents.length > 8 ||
    d.documents.reduce((n, a) => n + a.size, 0) > 2000000
  )
    throw new Error("Use up to eight documents and 2 MB total.");
  if (
    treatmentIds.some(
      (id) =>
        !s.records["Treatment Catalogue"].some(
          (t) => t.id === id && t.treatment,
        ),
    )
  )
    throw new Error("Select registered clinic treatments.");
  const record = {
    ...r,
    status: old?.status || "Available",
    machine: {
      ...d,
      events: [
        ...(old?.machine?.events || []),
        event(
          actor,
          old ? "Machine metadata updated" : "Machine registered",
          "Fictional manually maintained asset record",
          old?.status || "Available",
        ),
      ],
    },
  };
  let next = upsert(s, "Machines & Equipment", record);
  next = {
    ...next,
    records: {
      ...next.records,
      "Treatment Catalogue": next.records["Treatment Catalogue"].map((t) =>
        t.treatment
          ? {
              ...t,
              treatment: {
                ...t.treatment,
                machineIds: treatmentIds.includes(t.id)
                  ? [...new Set([...t.treatment.machineIds, r.id])]
                  : t.treatment.machineIds.filter((id) => id !== r.id),
              },
            }
          : t,
      ),
    },
  };
  return addActivity(
    next,
    `${r.name}: machine metadata and clinic compatibility updated.`,
  );
}
export function changeMachineStatus(
  s: ClinicState,
  id: string,
  status: MachineStatus,
  note: string,
  actor: string,
  confirmed: boolean,
) {
  const m = s.records["Machines & Equipment"].find((m) => m.id === id);
  if (!m?.machine) throw new Error("Machine not found.");
  if (!machineStatuses.includes(status) || !note.trim() || !confirmed)
    throw new Error(
      "Choose a status, record a reason and confirm this change.",
    );
  const open = s.records["Maintenance"].filter(
    (t) => t.machineId === id && activeMaintenance(t.status),
  );
  if (["Available", "In Use"].includes(status) && open.length)
    throw new Error(
      "Complete service documentation and clear every active maintenance task before restoring availability.",
    );
  if (["Under Maintenance", "Unavailable"].includes(status)) assertIdle(s, id);
  let next = upsert(s, "Machines & Equipment", {
    ...m,
    status,
    machine: {
      ...m.machine,
      events: [
        ...m.machine.events,
        event(actor, "Machine status changed", note, status),
      ],
    },
  });
  if (status === "Under Maintenance" && !open.length) {
    const task: RecordItem = {
      id: "maintenance-" + crypto.randomUUID().slice(0, 8),
      name: "Availability inspection & clearance",
      machineId: id,
      dueDate: DEMO_DATE,
      date: DEMO_DATE,
      status: "In Progress",
      amount: 0,
      detail: note,
      maintenance: {
        severity: "Priority",
        assignedTo: actor,
        notes: note,
        startedAt: new Date().toISOString(),
        events: [event(actor, "Maintenance started", note, "In Progress")],
      },
    };
    next = upsert(next, "Maintenance", task);
  }
  return addActivity(next, `${m.name}: ${status}. ${note}`);
}
export function saveMaintenance(
  s: ClinicState,
  r: RecordItem,
  actor: string,
  confirmed: boolean,
  restore = false,
) {
  const d = r.maintenance,
    m = s.records["Machines & Equipment"].find((m) => m.id === r.machineId),
    old = s.records["Maintenance"].find((t) => t.id === r.id);
  if (old && activeMaintenance(old.status) && old.machineId !== r.machineId)
    throw new Error(
      "An active maintenance task cannot be moved to another asset. Document clearance first.",
    );
  if (
    !m?.machine ||
    !d ||
    !r.name.trim() ||
    !validDate(r.dueDate || "") ||
    !d.assignedTo ||
    !d.notes.trim()
  )
    throw new Error(
      "Enter task, machine, due date, assigned employee and notes.",
    );
  if (
    ![
      "Scheduled",
      "In Progress",
      "Awaiting Clearance",
      "Completed",
      "Cancelled",
    ].includes(r.status)
  )
    throw new Error("Choose a valid maintenance status.");
  if (old && ["Completed", "Cancelled"].includes(old.status))
    throw new Error(
      "Completed or cancelled service records are retained read-only. Create another task.",
    );
  if (!confirmed)
    throw new Error(
      "Confirm the maintenance change and its effect on availability.",
    );
  if (activeMaintenance(r.status)) assertIdle(s, m.id);
  if (
    r.status === "Completed" &&
    (!validDate(d.serviceDate || "") ||
      !d.serviceNotes?.trim() ||
      d.serviceDate! > DEMO_DATE)
  )
    throw new Error(
      "Record a service date on/before the clinic operating day and clearance notes.",
    );
  if (
    ["Cancelled", "Scheduled"].includes(r.status) &&
    activeMaintenance(old?.status || "")
  )
    throw new Error(
      "An active maintenance task requires documented clearance; it cannot be cancelled to bypass the block.",
    );
  const at = new Date().toISOString(),
    record = {
      ...r,
      detail: d.notes,
      maintenance: {
        ...d,
        startedAt:
          old?.maintenance?.startedAt ||
          (activeMaintenance(r.status) ? at : undefined),
        clearedAt: r.status === "Completed" ? at : undefined,
        events: [
          ...(old?.maintenance?.events || []),
          event(
            actor,
            "Maintenance " + r.status,
            d.serviceNotes || d.notes,
            r.status,
          ),
        ],
      },
    };
  let next = upsert(s, "Maintenance", record);
  const otherActive = next.records["Maintenance"].some(
    (t) => t.machineId === m.id && activeMaintenance(t.status),
  );
  if (restore && (r.status !== "Completed" || otherActive))
    throw new Error(
      "Availability can only be restored after every active task has clearance.",
    );
  const status = activeMaintenance(r.status)
    ? "Under Maintenance"
    : restore
      ? "Available"
      : m.status;
  next = upsert(next, "Machines & Equipment", {
    ...m,
    status,
    machine: {
      ...m.machine,
      lastService:
        r.status === "Completed" ? d.serviceDate : m.machine.lastService,
      events: [
        ...m.machine.events,
        event(
          actor,
          "Maintenance " + r.status,
          d.serviceNotes || d.notes,
          status,
        ),
      ],
    },
  });
  return addActivity(
    next,
    `${m.name}: maintenance ${r.status.toLowerCase()}${restore ? "; availability restored" : ""}.`,
  );
}
export function saveRoom(
  s: ClinicState,
  r: RecordItem,
  actor: string,
  confirmed: boolean,
) {
  const d = r.room,
    old = s.records["Rooms & Resources"].find((v) => v.id === r.id);
  if (
    !d ||
    !r.name.trim() ||
    !d.code.trim() ||
    !Number.isInteger(d.capacity) ||
    d.capacity < 1 ||
    d.capacity > 20
  )
    throw new Error(
      "Enter a room name, unique code and seating capacity of 1–20.",
    );
  if (!["Available", "Unavailable"].includes(r.status))
    throw new Error("Choose room availability.");
  if (
    s.records["Rooms & Resources"].some(
      (v) =>
        v.id !== r.id && v.room?.code.toLowerCase() === d.code.toLowerCase(),
    )
  )
    throw new Error("This room code already exists.");
  if (!confirmed) throw new Error("Confirm the room change.");
  if (
    r.status === "Unavailable" &&
    s.appointments.some(
      (a) => a.room === old?.room?.code && a.status === "In progress",
    )
  )
    throw new Error(
      "An in-progress session is using this room. Request clinician review first.",
    );
  let next = upsert(s, "Rooms & Resources", {
    ...r,
    room: {
      ...d,
      events: [
        ...(old?.room?.events || []),
        event(
          actor,
          "Room updated",
          `${old?.room?.code || "New room"} → ${d.code}. ${d.notes}`,
          r.status,
        ),
      ],
    },
  });
  if (old?.room && old.room.code !== d.code)
    next = {
      ...next,
      appointments: next.appointments.map((a) =>
        a.room === old?.room?.code ? { ...a, room: d.code } : a,
      ),
      records: {
        ...next.records,
        "Sittings & Sessions": next.records["Sittings & Sessions"].map((v) =>
          v.session?.room === old?.room?.code
            ? { ...v, session: { ...v.session!, room: d.code } }
            : v,
        ),
      },
    };
  return addActivity(
    next,
    `${d.code}: room availability ${r.status.toLowerCase()}.`,
  );
}
export function saveProduct(s: ClinicState, r: RecordItem, actor: string) {
  const p = r.inventory,
    old = s.records["Inventory"].find((v) => v.id === r.id);
  if (
    !p ||
    !r.name.trim() ||
    !p.category.trim() ||
    !p.sku.trim() ||
    !p.batch.trim() ||
    !p.unit.trim() ||
    !p.supplier.trim()
  )
    throw new Error("Enter product, category, SKU, batch, unit and supplier.");
  if (p.expiry && !validDate(p.expiry))
    throw new Error("Enter a valid expiry date.");
  if (
    [p.quantity, p.minimumStock, p.purchaseCost, p.sellingPrice].some(
      (n) => !Number.isFinite(n) || n < 0,
    )
  )
    throw new Error("Stock, minimum stock and prices cannot be negative.");
  if (
    s.records["Inventory"].some(
      (v) =>
        v.id !== r.id &&
        v.inventory?.sku.toLowerCase() === p.sku.toLowerCase() &&
        v.inventory.batch.toLowerCase() === p.batch.toLowerCase(),
    )
  )
    throw new Error(
      "This SKU and batch already exist. Edit the existing product.",
    );
  if (old && old.inventory?.quantity !== p.quantity)
    throw new Error("Use a confirmed stock adjustment to change quantity.");
  let next = upsert(s, "Inventory", {
    ...r,
    status: stockStatus(r),
    amount: p.purchaseCost,
  });
  if (!old)
    next = {
      ...next,
      stockMovements: [
        ...(next.stockMovements || []),
        {
          id: "opening-" + r.id,
          productId: r.id,
          at: new Date().toISOString(),
          type: "Opening",
          quantity: p.quantity,
          before: 0,
          after: p.quantity,
          reason: "Manually entered opening stock",
          actor,
        },
      ],
    };
  return addActivity(
    next,
    `${r.name}: inventory product ${old ? "updated" : "registered"}.`,
  );
}
export function adjustStock(
  s: ClinicState,
  input: {
    id: string;
    productId: string;
    type: "Stock in" | "Stock out" | "Session usage";
    quantity: number;
    reason: string;
    actor: string;
    sessionId?: string;
  },
  confirmed: boolean,
): ClinicState {
  if (s.stockMovements?.some((m) => m.id === input.id)) return s;
  const r = s.records["Inventory"].find((r) => r.id === input.productId),
    p = r?.inventory;
  if (!p) throw new Error("Select an inventory product.");
  if (!confirmed || !input.reason.trim())
    throw new Error("Record a reason and confirm the stock adjustment.");
  if (!Number.isFinite(input.quantity) || input.quantity <= 0)
    throw new Error("Enter a positive quantity.");
  if (!["Stock in", "Stock out", "Session usage"].includes(input.type))
    throw new Error("Choose stock in, stock out or session usage.");
  const session =
    input.type === "Session usage"
      ? s.records["Sittings & Sessions"].find((r) => r.id === input.sessionId)
      : undefined;
  if (
    input.type === "Session usage" &&
    (!session?.session ||
      !["In Progress", "Awaiting Review", "Completed"].includes(session.status))
  )
    throw new Error(
      "Select an in-progress, awaiting-review or completed sitting. Scheduled and cancelled visits cannot consume stock.",
    );
  if (input.type === "Session usage" && p.expiry && p.expiry < DEMO_DATE)
    throw new Error(
      "Expired stock cannot be recorded as used during a session. Quarantine or stock it out with a reason.",
    );
  const after =
    p.quantity + (input.type === "Stock in" ? input.quantity : -input.quantity);
  if (after < 0)
    throw new Error(
      `Insufficient stock: ${p.quantity} ${p.unit} available. Negative stock is not supported.`,
    );
  const movement: StockMovement = {
    ...input,
    at: new Date().toISOString(),
    before: p.quantity,
    after,
    patientId: session?.patientId,
  };
  let next = upsert(s, "Inventory", {
    ...r,
    inventory: { ...p, quantity: after },
    status: stockStatus({ ...r, inventory: { ...p, quantity: after } }),
  });
  next = {
    ...next,
    stockMovements: [movement, ...(next.stockMovements || [])],
  };
  if (session?.session)
    next = {
      ...next,
      records: {
        ...next.records,
        "Sittings & Sessions": next.records["Sittings & Sessions"].map((v) =>
          v.id === session.id
            ? {
                ...v,
                session: {
                  ...v.session!,
                  inventoryUsageIds: [
                    ...(v.session!.inventoryUsageIds || []),
                    movement.id,
                  ],
                  audit: [
                    {
                      id: movement.id,
                      at: movement.at,
                      actor: input.actor,
                      status: v.status,
                      action: "Inventory usage recorded",
                      note: `${r!.name}: ${input.quantity} ${p.unit}. ${input.reason}`,
                    },
                    ...v.session!.audit,
                  ],
                },
              }
            : v,
        ),
      },
    };
  return addActivity(
    next,
    `${r!.name}: ${input.type.toLowerCase()} ${input.quantity} ${p.unit}; ${after} remaining. ${input.reason}`,
    session?.patientId,
  );
}
