export const metricDefinitions = {
  spots: { label: "Spots", unit: "demo index /100" },
  pigmentation: { label: "Pigmentation indicators", unit: "demo index /100" },
  pores: { label: "Pores", unit: "demo index /100" },
  wrinkles: { label: "Wrinkle indicators", unit: "demo index /100" },
  texture: { label: "Texture", unit: "demo index /100" },
  redness: { label: "Redness", unit: "demo index /100" },
  uv: { label: "UV indicators", unit: "demo index /100" },
  hydration: { label: "Hydration", unit: "demo index /100" },
};
export type MetricKey = keyof typeof metricDefinitions;
export type ScanMetrics = Partial<Record<MetricKey, number>>;
export type ReportStatus = "Draft" | "Awaiting Review" | "Reviewed";
export interface ScanAsset {
  id: string;
  name: string;
  mime: string;
  size: number;
  dataUrl: string;
  kind: "image" | "report";
  view?: string;
  demonstration?: boolean;
}
export interface ReviewEntry {
  id: string;
  at: string;
  doctor: string;
  status: ReportStatus;
  observations: string;
  recommendations: string;
  nextStep: string;
  note: string;
  courseId?: string;
}
export interface ScanDetails {
  deviceId: string;
  brand: string;
  model: string;
  serialNumber: string;
  area: string;
  captureStatus: "Draft" | "Imported Demo" | "Files uploaded";
  source:
    | "Seeded demonstration"
    | "Simulated import"
    | "Manual demo upload"
    | "Legacy record";
  consent: boolean;
  metrics: ScanMetrics;
  supportedMetrics: MetricKey[];
  assets: ScanAsset[];
  observations: string;
  recommendations: string;
  nextStep: string;
  reviewHistory: ReviewEntry[];
  measurementSource: "Demonstration data" | "Manual demonstration entries";
}
export interface ComparisonSnapshot {
  baselineId: string;
  followupId: string;
  area: string;
  metrics: {
    key: MetricKey;
    baseline: number;
    followup: number;
    delta: number;
  }[];
}
export const analysisDevices = [
  {
    id: "lumina-s7",
    brand: "LuminaDerm",
    model: "Spectra S7",
    description: "Multi-light facial capture · fictional demo machine",
    metrics: [
      "spots",
      "pigmentation",
      "pores",
      "wrinkles",
      "texture",
      "redness",
      "uv",
    ] as MetricKey[],
  },
  {
    id: "dermaview-pro",
    brand: "DermaView",
    model: "Clarity Pro",
    description: "Surface & hydration capture · fictional demo machine",
    metrics: ["hydration", "texture", "pigmentation", "pores"] as MetricKey[],
  },
  {
    id: "aura-m1",
    brand: "Aura Imaging",
    model: "SkinScope M1",
    description: "Compact face capture · fictional demo machine",
    metrics: ["spots", "pigmentation", "texture", "redness"] as MetricKey[],
  },
];
export const scanAreas = [
  "Full face",
  "Left cheek",
  "Right cheek",
  "Forehead",
  "Scalp",
];
export const canReviewScan = (role: string) =>
  role === "Clinic Owner" || role === "Doctor";
export const canCreateScan = (role: string) =>
  canReviewScan(role) || role === "Laser Technician";
