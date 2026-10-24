import type { ScanAsset } from "../scans/model";
export type MachineStatus =
  "Available" | "In Use" | "Under Maintenance" | "Unavailable";
export interface ResourceEvent {
  id: string;
  at: string;
  actor: string;
  action: string;
  note: string;
  status?: string;
}
export interface MachineData {
  brand: string;
  model: string;
  serial: string;
  category: string;
  roomId: string;
  lastService?: string;
  nextMaintenance?: string;
  planningMinutes: number;
  events: ResourceEvent[];
  documents: ScanAsset[];
}
export interface RoomData {
  code: string;
  capacity: number;
  notes: string;
  events: ResourceEvent[];
}
export interface MaintenanceData {
  severity: "Routine" | "Priority" | "Critical";
  assignedTo: string;
  notes: string;
  serviceDate?: string;
  serviceNotes?: string;
  startedAt?: string;
  clearedAt?: string;
  events: ResourceEvent[];
}
export interface InventoryData {
  category: string;
  sku: string;
  batch: string;
  expiry: string;
  quantity: number;
  unit: string;
  purchaseCost: number;
  sellingPrice: number;
  supplier: string;
  minimumStock: number;
}
export interface StockMovement {
  id: string;
  productId: string;
  at: string;
  type: "Opening" | "Stock in" | "Stock out" | "Session usage";
  quantity: number;
  before: number;
  after: number;
  reason: string;
  actor: string;
  sessionId?: string;
  patientId?: string;
}
export const machineStatuses: MachineStatus[] = [
  "Available",
  "In Use",
  "Under Maintenance",
  "Unavailable",
];
export const machineBlocked = (status: string) =>
  [
    "Under Maintenance",
    "Maintenance",
    "Unavailable",
    "Offline",
    "Out of service",
  ].includes(status);
export const activeMaintenance = (status: string) =>
  ["In Progress", "In progress", "Awaiting Clearance"].includes(status);
