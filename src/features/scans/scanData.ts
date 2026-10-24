import type { ClinicState } from "../../data";
import { analysisDevices, type ScanDetails } from "./model";
import { demoAssets } from "./assets";
export function enrichScanState(s: ClinicState): ClinicState {
  if (s.scanSchemaVersion === 1) return s;
  s.scanSchemaVersion = 1;
  s.records["Skin Analysis"] = s.records["Skin Analysis"].map((r, i) => {
    if (r.scan) return r;
    const known = [
      "skin-analysis-1",
      "skin-analysis-2",
      "scan-history-1041",
    ].includes(r.id);
    const legacy = r.measurements || {};
    const metrics = { ...legacy };
    const device = analysisDevices[1];
    const scan: ScanDetails = {
      deviceId: device.id,
      brand: device.brand,
      model: device.model,
      serialNumber: known ? "DEMO-CP-014" : "Not recorded",
      area: "Full face",
      captureStatus: known ? "Imported Demo" : "Draft",
      source: known ? "Seeded demonstration" : "Legacy record",
      consent: known,
      metrics,
      supportedMetrics: device.metrics,
      assets: known ? demoAssets(i) : [],
      observations:
        r.status === "Reviewed"
          ? "Fictional demonstration report reviewed for longitudinal documentation. Source indices are retained without a diagnostic interpretation."
          : "",
      recommendations: "",
      nextStep:
        r.status === "Reviewed"
          ? "Discuss the recorded report at the next clinician-led review."
          : "",
      reviewHistory: [],
      measurementSource: "Demonstration data",
    };
    return {
      ...r,
      date: r.date || "2026-10-23",
      status:
        r.status === "Reviewed"
          ? "Reviewed"
          : r.status === "Draft"
            ? "Draft"
            : "Awaiting Review",
      courseId:
        r.courseId ||
        s.records["Treatment Plans"].find((c) => c.patientId === r.patientId)
          ?.id,
      scan,
    };
  });
  if (
    s.patients.some((p) => p.id === "MM-1042") &&
    !s.records["Skin Analysis"].some((r) => r.id === "SCAN-2026-0844")
  ) {
    const d = analysisDevices[0];
    s.records["Skin Analysis"].push({
      id: "SCAN-2026-0844",
      patientId: "MM-1042",
      name: s.patients.find((p) => p.id === "MM-1042")!.name,
      date: "2026-10-23",
      amount: 0,
      status: "Draft",
      detail: "Full face scan · capture draft",
      courseId: "course-MM-1042",
      scan: {
        deviceId: d.id,
        brand: d.brand,
        model: d.model,
        serialNumber: "DEMO-S7-004",
        area: "Full face",
        captureStatus: "Draft",
        source: "Manual demo upload",
        consent: false,
        metrics: {},
        supportedMetrics: d.metrics,
        assets: [],
        observations: "",
        recommendations: "",
        nextStep: "",
        reviewHistory: [],
        measurementSource: "Manual demonstration entries",
      },
    });
  }
  if (
    s.patients.some((p) => p.id === "MM-1045") &&
    !s.records["Skin Analysis"].some((r) => r.id === "SCAN-2026-0845")
  ) {
    const d = analysisDevices[2];
    s.records["Skin Analysis"].push({
      id: "SCAN-2026-0845",
      patientId: "MM-1045",
      name: s.patients.find((p) => p.id === "MM-1045")!.name,
      date: "2026-10-21",
      amount: 0,
      status: "Awaiting Review",
      detail: "Full face scan · simulated imported report",
      scan: {
        deviceId: d.id,
        brand: d.brand,
        model: d.model,
        serialNumber: "DEMO-M1-021",
        area: "Full face",
        captureStatus: "Imported Demo",
        source: "Seeded demonstration",
        consent: true,
        metrics: { spots: 34, pigmentation: 41, texture: 57, redness: 28 },
        supportedMetrics: d.metrics,
        assets: demoAssets(4),
        observations: "",
        recommendations: "",
        nextStep: "",
        reviewHistory: [],
        measurementSource: "Demonstration data",
      },
    });
  }
  return s;
}
