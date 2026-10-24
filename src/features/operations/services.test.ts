import { beforeEach, describe, it, expect } from "vitest";
import {
  resetState,
  readState,
  saveState,
  DEMO_DATE,
  type Appointment,
} from "../../data";
import { bookingErrors, saveAppointment } from "../scheduling/services";
import {
  reviewReady,
  sessionRecord,
  clinician,
} from "../sessions/testFixtures";
import { saveSessionDraft, completeSession } from "../sessions/services";
import {
  changeMachineStatus,
  saveMaintenance,
  saveRoom,
  saveProduct,
  adjustStock,
  saveMachine,
} from "./services";
import { machineStatus, machineUsage, stockStatus } from "./selectors";
import { enrichOperations } from "./operationsData";
const actor = "Demo operations";
function booking(s = resetState()): Appointment {
  return {
    ...s.appointments[0],
    id: "operation-booking",
    patientId: "MM-1046",
    courseId: undefined,
    treatment: "HydraFacial",
    machineId: "machines-equipment-2",
    doctor: "Dr. Mehta",
    technician: "Neha Rao",
    room: "Room 04",
    time: "18:00",
    duration: 45,
    date: DEMO_DATE,
    status: "Confirmed",
    sitting: 1,
    totalSittings: 1,
  };
}
const move = (
  id: string,
  type: "Stock in" | "Stock out" | "Session usage",
  quantity: number,
  sessionId?: string,
) => ({
  id,
  type,
  quantity,
  productId: "inventory-2",
  reason: "Fictional verified stock movement",
  actor,
  sessionId,
});
beforeEach(() => localStorage.clear());
describe("operations shared-store integrity", () => {
  it("seeds five machines, four rooms, twelve batches and one opening movement per batch; migration is repeatable", () => {
    const s = resetState();
    expect(s.records["Machines & Equipment"]).toHaveLength(5);
    expect(s.records["Rooms & Resources"]).toHaveLength(4);
    expect(s.records.Inventory).toHaveLength(12);
    expect(s.stockMovements).toHaveLength(12);
    expect(enrichOperations(s)).toBe(s);
    expect(s.stockMovements).toHaveLength(12);
    expect(s.records.Inventory.some((p) => stockStatus(p) === "Expired")).toBe(
      true,
    );
  });
  it("preserves user-created legacy products and structured quantity during migration", () => {
    const s = resetState();
    s.operationsSchemaVersion = undefined;
    s.records.Inventory[0].inventory!.quantity = 99;
    s.records.Inventory.push({
      id: "legacy-custom",
      name: "Custom supply",
      detail: "User record",
      status: "In stock",
      amount: 0,
    });
    const next = enrichOperations(s);
    expect(next.records.Inventory[0].inventory!.quantity).toBe(99);
    expect(
      next.records.Inventory.find((r) => r.id === "legacy-custom")?.name,
    ).toBe("Custom supply");
    expect(
      next.records.Inventory.find((r) => r.id === "legacy-custom")?.inventory!
        .quantity,
    ).toBe(0);
  });
  it("blocks booking during maintenance and permits the same eligible slot after documented clearance", () => {
    const s = resetState(),
      a = booking(s);
    expect(bookingErrors(s, a)).toEqual([]);
    const blocked = changeMachineStatus(
      s,
      a.machineId!,
      "Under Maintenance",
      "Fictional inspection",
      actor,
      true,
    );
    expect(bookingErrors(blocked, a).join(" ")).toMatch(/under maintenance/i);
    expect(() => saveAppointment(blocked, a, actor, "Test")).toThrow(
      /maintenance/i,
    );
    expect(() =>
      changeMachineStatus(
        blocked,
        a.machineId!,
        "Available",
        "Bypass",
        actor,
        true,
      ),
    ).toThrow(/clear/);
    const task = blocked.records.Maintenance.find(
      (t) => t.machineId === a.machineId && t.status === "In Progress",
    )!;
    const cleared = saveMaintenance(
      blocked,
      {
        ...task,
        status: "Completed",
        maintenance: {
          ...task.maintenance!,
          serviceDate: DEMO_DATE,
          serviceNotes: "Fictional inspection passed and clearance recorded",
        },
      },
      actor,
      true,
      true,
    );
    expect(
      machineStatus(
        cleared,
        cleared.records["Machines & Equipment"].find(
          (m) => m.id === a.machineId,
        )!,
      ),
    ).toBe("Available");
    expect(bookingErrors(cleared, a)).toEqual([]);
    expect(
      saveAppointment(cleared, a, actor, "Cleared").appointments.some(
        (v) => v.id === a.id,
      ),
    ).toBe(true);
  });
  it("requires explicit confirmation and prevents active service cancellation bypass", () => {
    const s = resetState();
    expect(() =>
      changeMachineStatus(
        s,
        "machines-equipment-2",
        "Unavailable",
        "Test",
        actor,
        false,
      ),
    ).toThrow(/confirm/);
    const task = s.records.Maintenance.find(
      (t) => t.id === "maintenance-lumina",
    )!;
    expect(() =>
      saveMaintenance(s, { ...task, status: "Cancelled" }, actor, true),
    ).toThrow(/clearance/);
    expect(() =>
      saveMaintenance(s, { ...task, status: "Completed" }, actor, true, true),
    ).toThrow(/service date/);
  });
  it("rejects unavailable rooms and shared room overlaps; adding a room does not reassign bookings", () => {
    const s = resetState(),
      r = s.records["Rooms & Resources"][3],
      a = booking(s);
    const blocked = saveRoom(s, { ...r, status: "Unavailable" }, actor, true);
    expect(bookingErrors(blocked, a).join(" ")).toContain("unavailable");
    const restored = saveRoom(
      blocked,
      { ...r, status: "Available" },
      actor,
      true,
    );
    const booked = saveAppointment(restored, a, actor, "Confirmed");
    expect(
      bookingErrors(booked, {
        ...a,
        id: "second",
        patientId: "MM-1045",
        doctor: "Dr. Aditi Shah",
        technician: "Other operator",
        machineId: undefined,
        treatment: "Chemical Peel",
      }).join(" "),
    ).toContain("Room Room 04");
    const added = saveRoom(
      s,
      { ...r, id: "new-room", room: { ...r.room!, code: "Room 05" } },
      actor,
      true,
    );
    expect(added.appointments).toEqual(s.appointments);
  });
  it("retains every accepted stock adjustment, rejects negatives and deduplicates retry IDs", () => {
    let s = resetState();
    const before = s.records.Inventory.find((p) => p.id === "inventory-2")!
      .inventory!.quantity;
    s = adjustStock(s, move("in", "Stock in", 5), true);
    s = adjustStock(s, move("out", "Stock out", 2), true);
    expect(
      s.records.Inventory.find((p) => p.id === "inventory-2")!.inventory!
        .quantity,
    ).toBe(before + 3);
    expect(adjustStock(s, move("out", "Stock out", 2), true)).toBe(s);
    expect(() =>
      adjustStock(s, move("negative", "Stock out", 999), true),
    ).toThrow(/Negative stock/);
    expect(() =>
      adjustStock(s, move("unconfirmed", "Stock out", 1), false),
    ).toThrow(/confirm/);
    expect(() => adjustStock(s, move("zero", "Stock out", 0), true)).toThrow(
      /positive/,
    );
    saveState(s);
    expect(readState().stockMovements).toEqual(s.stockMovements);
  });
  it("links session usage and audit, preserves it through stale draft saves and does not deduct again on completion", () => {
    let s = reviewReady();
    const r = sessionRecord(s),
      draft = structuredClone(r.session!),
      before = s.records.Inventory[1].inventory!.quantity;
    s = adjustStock(s, move("usage", "Session usage", 2, r.id), true);
    expect(s.records.Inventory[1].inventory!.quantity).toBe(before - 2);
    expect(sessionRecord(s).session!.inventoryUsageIds).toEqual(["usage"]);
    s = saveSessionDraft(s, r.id, draft, clinician.name);
    expect(sessionRecord(s).session!.inventoryUsageIds).toEqual(["usage"]);
    s = completeSession(s, r.id, clinician, "Confirmed review");
    expect(s.records.Inventory[1].inventory!.quantity).toBe(before - 2);
    expect(s.stockMovements!.filter((m) => m.id === "usage")).toHaveLength(1);
    expect(
      s.activity.some(
        (v) =>
          v.patientId === r.patientId && v.message.includes("session usage"),
      ),
    ).toBe(true);
  });
  it("rejects usage for scheduled/cancelled sessions and expired batches", () => {
    const s = resetState(),
      r = sessionRecord(s);
    expect(() =>
      adjustStock(s, move("scheduled", "Session usage", 1, r.id), true),
    ).toThrow(/Scheduled and cancelled/);
    const ready = reviewReady();
    expect(() =>
      adjustStock(
        ready,
        {
          ...move("expired", "Session usage", 1, sessionRecord(ready).id),
          productId: "inventory-8",
        },
        true,
      ),
    ).toThrow(/Expired/);
  });
  it("product edit cannot bypass stock logging and duplicate SKU/batch is rejected", () => {
    const s = resetState(),
      p = s.records.Inventory[0];
    expect(() =>
      saveProduct(
        s,
        { ...p, inventory: { ...p.inventory!, quantity: 2 } },
        actor,
      ),
    ).toThrow(/adjustment/);
    expect(() => saveProduct(s, { ...p, id: "duplicate" }, actor)).toThrow(
      /already exist/,
    );
  });
  it("updates catalogue compatibility and keeps utilisation derived from bookings, without invented telemetry", () => {
    const s = resetState(),
      m = s.records["Machines & Equipment"][4],
      t = s.records["Treatment Catalogue"][0];
    const next = saveMachine(
      s,
      { ...m, machine: { ...m.machine!, serial: "DEMO-EDIT" } },
      [t.id],
      actor,
    );
    expect(
      next.records["Treatment Catalogue"].find((v) => v.id === t.id)!.treatment!
        .machineIds,
    ).toContain(m.id);
    const u = machineUsage(s, m.id);
    expect(u.minutes).toBe(0);
    expect(u.shots).toBeUndefined();
    expect(u.utilisation).toBe(0);
  });
});
