import { DEMO_DATE, type ClinicState, type RecordItem } from "../../data";
import type { InventoryData, MachineData, ResourceEvent } from "./model";
const event = (id: string, status: string, note: string): ResourceEvent => ({
  id: "seed-" + id,
  at: "2026-10-23T09:00:00+05:30",
  actor: "Demo clinic operations",
  action: "Fictional opening record",
  status,
  note,
});
export function enrichOperations(s: ClinicState): ClinicState {
  if (s.operationsSchemaVersion === 1) return s;
  s.operationsSchemaVersion = 1;
  s.stockMovements ||= [];
  s.records["Rooms & Resources"] ||= [];
  const names = [
    "Laser & treatment suite",
    "Procedure room",
    "Skin treatment room",
    "Assessment room",
  ];
  for (let i = 0; i < 4; i++)
    if (!s.records["Rooms & Resources"].some((r) => r.id === "room-" + (i + 1)))
      s.records["Rooms & Resources"].push({
        id: "room-" + (i + 1),
        name: names[i],
        detail: "Fictional clinic room · exclusive appointment resource",
        status: "Available",
        amount: 0,
        room: {
          code: "Room 0" + (i + 1),
          capacity: i === 3 ? 2 : 1,
          notes:
            "Capacity refers to seating; overlapping appointments are not permitted.",
          events: [event("room-" + i, "Available", "Demo room opening record")],
        },
      });
  s.records["Machines & Equipment"] = s.records["Machines & Equipment"].map(
    (r, i) => {
      if (r.machine) return r;
      const status =
        r.status === "In use"
          ? "Available"
          : r.status === "Maintenance"
            ? "Under Maintenance"
            : r.status;
      const machine: MachineData = {
        brand:
          i === 0
            ? "Alma · demo asset"
            : i === 1
              ? "HydraFacial · demo asset"
              : "Dermapen · demo asset",
        model: ["ICE Platinum", "Elite", "4"][i] || "Demo model",
        serial: "DEMO-ASSET-00" + (i + 1),
        category:
          ["Laser", "Facial system", "Microneedling"][i] || "Clinic equipment",
        roomId: ["room-1", "room-1", "room-3"][i] || "room-4",
        lastService: "2026-09-18",
        nextMaintenance: i === 0 ? "2026-10-28" : "2026-10-24",
        planningMinutes: 480,
        events: [
          event(
            r.id,
            status,
            "Manually maintained fictional asset. No device connection.",
          ),
        ],
        documents: [],
      };
      return {
        ...r,
        status,
        detail: "Fictional asset · manual operations record",
        machine,
      };
    },
  );
  for (const [id, name, category, status] of [
    [
      "machines-equipment-4",
      "MM Lumina IPL",
      "Light-based system",
      "Under Maintenance",
    ],
    [
      "machines-equipment-5",
      "MM Cryo Comfort",
      "Cooling support",
      "Unavailable",
    ],
  ])
    if (!s.records["Machines & Equipment"].some((r) => r.id === id))
      s.records["Machines & Equipment"].push({
        id,
        name,
        detail: "Fictional clinic device · no connected hardware",
        status,
        amount: 0,
        machine: {
          brand: "MM Demo Devices",
          model: name.replace("MM ", ""),
          serial: "DEMO-ASSET-00" + id.slice(-1),
          category,
          roomId: "room-4",
          lastService: "2026-09-20",
          nextMaintenance: "2026-10-25",
          planningMinutes: 480,
          events: [
            event(
              id,
              status,
              status === "Under Maintenance"
                ? "Awaiting fictional service clearance"
                : "Operator availability check pending",
            ),
          ],
          documents: [],
        },
      });
  s.records["Maintenance"] = s.records["Maintenance"].map((r, i) => ({
    ...r,
    machineId: r.machineId || "machines-equipment-" + (i + 1),
    dueDate: r.dueDate || ["2026-10-28", "2026-10-24"][i] || DEMO_DATE,
    status: r.status === "Completed" ? "Completed" : "Scheduled",
    maintenance: r.maintenance || {
      severity: "Routine",
      assignedTo: i === 0 ? "Aarav Singh" : "Neha Rao",
      notes: r.detail,
      events: [event(r.id, "Scheduled", "Imported fictional maintenance task")],
    },
  }));
  const tasks: RecordItem[] = [
    {
      id: "maintenance-lumina",
      name: "Electrical inspection & clearance",
      machineId: "machines-equipment-4",
      dueDate: "2026-10-25",
      date: "2026-10-22",
      status: "In Progress",
      amount: 0,
      detail: "Fictional service task; asset blocked until clearance",
      maintenance: {
        severity: "Priority",
        assignedTo: "Neha Rao",
        notes:
          "Operator recorded a power check issue. No real device is connected.",
        startedAt: "2026-10-22T09:00:00+05:30",
        events: [
          event("lumina", "In Progress", "Asset placed under maintenance"),
        ],
      },
    },
    {
      id: "maintenance-service-history",
      name: "Preventive service completed",
      machineId: "machines-equipment-1",
      dueDate: "2026-09-18",
      date: "2026-09-18",
      status: "Completed",
      amount: 0,
      detail: "Fictional retained service record",
      maintenance: {
        severity: "Routine",
        assignedTo: "Aarav Singh",
        notes: "Routine documented maintenance",
        serviceDate: "2026-09-18",
        serviceNotes:
          "Fictional inspection completed and availability cleared.",
        startedAt: "2026-09-18T09:00:00+05:30",
        clearedAt: "2026-09-18T10:00:00+05:30",
        events: [
          event(
            "service-1",
            "Completed",
            "Manually recorded service clearance",
          ),
        ],
      },
    },
  ];
  for (const t of tasks)
    if (!s.records["Maintenance"].some((r) => r.id === t.id))
      s.records["Maintenance"].push(t);
  const products: [
    string,
    string,
    string,
    string,
    number,
    string,
    number,
    number,
    number,
  ][] = [
    [
      "PRP collection kits",
      "Procedure consumable",
      "PRP-001",
      "2027-02-28",
      12,
      "kits",
      240,
      420,
      15,
    ],
    [
      "Conductive gel",
      "Treatment consumable",
      "GEL-001",
      "2027-04-30",
      28,
      "bottles",
      180,
      280,
      10,
    ],
    [
      "Sterile gloves",
      "PPE",
      "PPE-001",
      "2027-10-31",
      45,
      "boxes",
      320,
      450,
      20,
    ],
    [
      "Sterile gauze",
      "Procedure consumable",
      "GAU-001",
      "2027-01-31",
      18,
      "packs",
      90,
      130,
      10,
    ],
    [
      "Cleansing solution",
      "Skin preparation",
      "CLN-001",
      "2026-10-30",
      8,
      "bottles",
      200,
      320,
      5,
    ],
    [
      "Disposable bed rolls",
      "Hygiene",
      "BED-001",
      "2028-03-31",
      6,
      "rolls",
      260,
      350,
      8,
    ],
    [
      "Applicator tips",
      "Accessories",
      "TIP-001",
      "2027-08-31",
      24,
      "pieces",
      150,
      240,
      10,
    ],
    [
      "Cooling masks",
      "Aftercare consumable",
      "MSK-001",
      "2026-10-20",
      9,
      "packs",
      120,
      190,
      5,
    ],
    [
      "Disposable caps",
      "PPE",
      "CAP-001",
      "2027-09-30",
      40,
      "packs",
      75,
      110,
      15,
    ],
    [
      "Skin marker pens",
      "Accessories",
      "PEN-001",
      "2027-02-28",
      4,
      "pieces",
      60,
      95,
      6,
    ],
    [
      "Eye protection pads",
      "PPE",
      "EYE-001",
      "2026-11-10",
      20,
      "pairs",
      45,
      70,
      10,
    ],
    [
      "Microfibre towels",
      "Clinic supplies",
      "TWL-001",
      "2028-12-31",
      30,
      "pieces",
      100,
      160,
      12,
    ],
  ];
  const existing = s.records["Inventory"];
  s.records["Inventory"] = products.map(
    (
      [
        name,
        category,
        sku,
        expiry,
        quantity,
        unit,
        purchaseCost,
        sellingPrice,
        minimumStock,
      ],
      i,
    ) => {
      const old = existing.find((r) => r.id === "inventory-" + (i + 1));
      const inventory: InventoryData = {
        category,
        sku,
        batch: "DEMO-BATCH-" + String(i + 1).padStart(3, "0"),
        expiry,
        quantity,
        unit,
        purchaseCost,
        sellingPrice,
        supplier: i % 2 ? "Demo Care Supplies" : "Fictional Clinic Supply Co.",
        minimumStock,
      };
      return {
        ...old,
        id: old?.id || "inventory-" + (i + 1),
        name: old?.name || name,
        detail: "Fictional stock · manually recorded batch",
        status: quantity <= minimumStock ? "Low stock" : "In stock",
        amount: purchaseCost,
        inventory: old?.inventory || inventory,
      };
    },
  );
  for (const r of existing)
    if (!s.records["Inventory"].some((v) => v.id === r.id))
      s.records["Inventory"].push({
        ...r,
        inventory: r.inventory || {
          category: "Unclassified",
          sku: r.id,
          batch: "Legacy",
          expiry: "",
          quantity: 0,
          unit: "units",
          purchaseCost: 0,
          sellingPrice: 0,
          supplier: "Not recorded",
          minimumStock: 0,
        },
      });
  for (const r of s.records["Inventory"])
    if (!s.stockMovements.some((m) => m.productId === r.id))
      s.stockMovements.push({
        id: "opening-" + r.id,
        productId: r.id,
        at: DEMO_DATE + "T08:00:00+05:30",
        type: "Opening",
        quantity: r.inventory!.quantity,
        before: 0,
        after: r.inventory!.quantity,
        reason: "Fictional opening stock; not a live inventory import",
        actor: "Demo clinic operations",
      });
  return s;
}
