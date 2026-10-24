import type { ClinicState, RecordItem } from "../../data";
import {
  metricDefinitions,
  type MetricKey,
  type ScanMetrics,
  type ReportStatus,
  type ReviewEntry,
  type ScanDetails,
} from "./model";
export function scanMetrics(r: RecordItem): ScanMetrics {
  return r.scan?.metrics || r.measurements || {};
}
export function metricEntries(r: RecordItem) {
  return (Object.keys(metricDefinitions) as MetricKey[])
    .filter((key) => Number.isFinite(scanMetrics(r)[key]))
    .map((key) => ({
      key,
      ...metricDefinitions[key],
      value: scanMetrics(r)[key]!,
    }));
}
export function comparableMetrics(baseline: RecordItem, followup: RecordItem) {
  if (!compatibleScans(baseline, followup)) return [];
  const a = scanMetrics(baseline),
    b = scanMetrics(followup);
  return metricEntries(baseline)
    .filter((m) => Number.isFinite(b[m.key]))
    .map((m) => ({
      ...m,
      baseline: a[m.key]!,
      followup: b[m.key]!,
      delta: Math.round((b[m.key]! - a[m.key]!) * 10) / 10,
    }));
}
export function compatibleScans(a: RecordItem, b: RecordItem) {
  return (
    a.id !== b.id &&
    !!a.patientId &&
    a.patientId === b.patientId &&
    !!a.scan?.area &&
    a.scan.area === b.scan?.area &&
    (a.date || "") <= (b.date || "")
  );
}
export function reviewReadiness(r: RecordItem) {
  if (!r.patientId) return "Link a patient before requesting review.";
  if (!r.scan?.consent)
    return "Record relevant consent before requesting review.";
  if (!r.scan.assets.length)
    return "Attach a demonstration report or capture before requesting review.";
  if (!r.date || !r.scan.brand.trim() || !r.scan.model.trim())
    return "Complete the scan date and device metadata.";
  return "";
}
export function putScan(s: ClinicState, r: RecordItem): ClinicState {
  if (!s.patients.some((p) => p.id === r.patientId))
    throw new Error("Choose an existing patient.");
  if (
    r.courseId &&
    !s.records["Treatment Plans"].some(
      (c) => c.id === r.courseId && c.patientId === r.patientId,
    )
  )
    throw new Error("The course must belong to the selected patient.");
  for (const value of Object.values(r.scan?.metrics || {}))
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 100
    )
      throw new Error("Measurement indices must be between 0 and 100.");
  return {
    ...s,
    records: {
      ...s.records,
      "Skin Analysis": s.records["Skin Analysis"].some(
        (item) => item.id === r.id,
      )
        ? s.records["Skin Analysis"].map((item) =>
            item.id === r.id ? r : item,
          )
        : [r, ...s.records["Skin Analysis"]],
    },
  };
}
export function saveScanReview(
  s: ClinicState,
  id: string,
  entry: Omit<ReviewEntry, "id" | "at">,
): ClinicState {
  const report = s.records["Skin Analysis"].find((r) => r.id === id);
  if (!report?.scan) throw new Error("Scan report not found.");
  const error = reviewReadiness(report);
  if (error) throw new Error(error);
  if (!entry.doctor.trim()) throw new Error("Choose a reviewing doctor.");
  if (entry.status === "Reviewed" && entry.observations.trim().length < 5)
    throw new Error(
      "Add clinician observations before marking this report reviewed.",
    );
  const history: ReviewEntry = {
    ...entry,
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
  };
  return putScan(s, {
    ...report,
    status: entry.status,
    reviewedBy: entry.status === "Reviewed" ? entry.doctor : undefined,
    doctor: entry.doctor,
    courseId: entry.courseId,
    scan: {
      ...report.scan,
      observations: entry.observations.trim(),
      recommendations: entry.recommendations.trim(),
      nextStep: entry.nextStep.trim(),
      reviewHistory: [history, ...report.scan.reviewHistory],
    },
  });
}
export function emptyScan(
  deviceId: string,
  brand: string,
  model: string,
  metrics: MetricKey[],
): ScanDetails {
  return {
    deviceId,
    brand,
    model,
    serialNumber: "",
    area: "Full face",
    captureStatus: "Draft",
    source: "Manual demo upload",
    consent: false,
    metrics: {},
    supportedMetrics: metrics,
    assets: [],
    observations: "",
    recommendations: "",
    nextStep: "",
    reviewHistory: [],
    measurementSource: "Manual demonstration entries",
  };
}
export const reportStatuses: ReportStatus[] = [
  "Draft",
  "Awaiting Review",
  "Reviewed",
];
export function saveComparisonNote(
  s: ClinicState,
  baselineId: string,
  followupId: string,
  doctor: string,
  note: string,
): ClinicState {
  const scans = s.records["Skin Analysis"];
  const baseline = scans.find((r) => r.id === baselineId),
    followup = scans.find((r) => r.id === followupId);
  if (!baseline || !followup || !compatibleScans(baseline, followup))
    throw new Error(
      "Choose different scans of the same patient and area, in date order.",
    );
  const patient = s.patients.find((p) => p.id === baseline.patientId);
  if (!patient) throw new Error("Patient record not found.");
  if (!doctor.trim() || !note.trim())
    throw new Error("Enter a clinician and a progress note.");
  const record: RecordItem = {
    id: "progress-" + crypto.randomUUID(),
    name: patient.name,
    patientId: patient.id,
    amount: 0,
    date: "2026-10-23",
    status: "Reviewed",
    doctor,
    detail: note.trim(),
    courseId: followup.courseId,
    scanComparison: {
      baselineId,
      followupId,
      area: baseline.scan!.area,
      metrics: comparableMetrics(baseline, followup).map(
        ({ key, baseline, followup, delta }) => ({
          key,
          baseline,
          followup,
          delta,
        }),
      ),
    },
  };
  return {
    ...s,
    records: {
      ...s.records,
      "Clinical Documents": [record, ...s.records["Clinical Documents"]],
    },
  };
}
