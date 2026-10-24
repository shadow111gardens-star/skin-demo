export interface InvoiceLine {
  id: string;
  kind: "Consultation" | "Procedure" | "Package" | "Product" | "Deposit";
  description: string;
  quantity: number;
  price: number;
  discount: number;
  taxIds: string[];
  productId?: string;
  packageId?: string;
}
export interface TaxConfig {
  id: string;
  name: string;
  rate: number;
  active: boolean;
}
export interface InvoiceData {
  number: string;
  state: "Draft" | "Issued" | "Void";
  issueDate: string;
  dueDate: string;
  lines: InvoiceLine[];
  discount: number;
  taxes: TaxConfig[];
  notes: string;
  events: { id: string; at: string; action: string; note: string }[];
  voidReason?: string;
}
export interface PaymentData {
  kind: "Receipt" | "Refund";
  invoiceId?: string;
  refundOf?: string;
  method: "Cash" | "UPI" | "Card" | "Bank Transfer" | "Other";
  reference: string;
  note: string;
  createdAt: string;
  requestId: string;
}
export interface PackageConfig {
  treatmentId: string;
  area: string;
  sessions: number;
  price: number;
  discount: number;
  validityDays: number;
  terms: string;
}
export const methods = [
  "Cash",
  "UPI",
  "Card",
  "Bank Transfer",
  "Other",
] as const;
export const lineKinds = [
  "Consultation",
  "Procedure",
  "Package",
  "Product",
  "Deposit",
] as const;
