import { describe, it, expect } from "vitest";
import { resetState } from "../../data";
import {
  metricEntries,
  comparableMetrics,
  compatibleScans,
  putScan,
  saveScanReview,
} from "./services";
import { validateUpload } from "./assets";
describe("scan integrity", () => {
  it("migrates fictional captures without duplicating patients or inventing missing measures", () => {
    const s = resetState();
    expect(s.patients).toHaveLength(6);
    const draft = s.records["Skin Analysis"].find((r) => r.status === "Draft")!;
    expect(metricEntries(draft)).toEqual([]);
    const r = s.records["Skin Analysis"].find(
      (r) => r.id === "skin-analysis-1",
    )!;
    expect(r.scan?.assets).toHaveLength(2);
    expect(metricEntries(r).map((m) => m.key)).toEqual([
      "pigmentation",
      "texture",
      "hydration",
    ]);
  });
  it("compares common supplied indices only and rejects unrelated or reversed captures", () => {
    const s = resetState();
    const a = s.records["Skin Analysis"].find(
      (r) => r.id === "scan-history-1041",
    )!;
    const b = s.records["Skin Analysis"].find(
      (r) => r.id === "skin-analysis-1",
    )!;
    expect(compatibleScans(a, b)).toBe(true);
    expect(comparableMetrics(a, b)).toHaveLength(3);
    expect(
      comparableMetrics(a, {
        ...b,
        scan: { ...b.scan!, metrics: { texture: 70 } },
      }),
    ).toEqual([expect.objectContaining({ key: "texture", delta: 14 })]);
    expect(compatibleScans(b, a)).toBe(false);
    expect(compatibleScans(a, { ...b, patientId: "MM-1042" })).toBe(false);
    expect(
      compatibleScans(a, { ...b, scan: { ...b.scan!, area: "Scalp" } }),
    ).toBe(false);
  });
  it("preserves scan identity on editing and enforces patient course and measure limits", () => {
    const s = resetState();
    const r = s.records["Skin Analysis"][0];
    const edited = putScan(s, { ...r, detail: "Updated demo capture" });
    expect(edited.records["Skin Analysis"]).toHaveLength(
      s.records["Skin Analysis"].length,
    );
    expect(() => putScan(s, { ...r, courseId: "course-MM-1042" })).toThrow(
      "course",
    );
    expect(() =>
      putScan(s, { ...r, scan: { ...r.scan!, metrics: { texture: 101 } } }),
    ).toThrow("between 0 and 100");
  });
  it("requires consent and clinician observations and records a review history snapshot", () => {
    const s = resetState();
    const r = s.records["Skin Analysis"][0];
    const entry = {
      doctor: "Dr. Mehta",
      status: "Reviewed" as const,
      observations: "Source report discussed with the patient.",
      recommendations: "Review during consultation",
      nextStep: "Discuss at next visit",
      note: "Checked original source",
      courseId: r.courseId,
    };
    expect(() =>
      saveScanReview(s, r.id, { ...entry, observations: "" }),
    ).toThrow("observations");
    const updated = saveScanReview(s, r.id, entry);
    expect(updated.records["Skin Analysis"][0]).toMatchObject({
      status: "Reviewed",
      reviewedBy: "Dr. Mehta",
      scan: {
        observations: entry.observations,
        reviewHistory: [expect.objectContaining({ note: entry.note })],
      },
    });
    const draft = s.records["Skin Analysis"].find((r) => r.status === "Draft")!;
    expect(() => saveScanReview(s, draft.id, entry)).toThrow("consent");
  });
  it("validates upload MIME, extension, size and empty files", () => {
    expect(
      validateUpload(
        new File(["pdf"], "demo.pdf", { type: "application/pdf" }),
        "report",
      ),
    ).toBe("");
    expect(
      validateUpload(
        new File(["x"], "fake.jpg", { type: "text/html" }),
        "image",
      ),
    ).toContain("JPG");
    expect(
      validateUpload(
        new File(["x"], "report.exe", { type: "application/pdf" }),
        "report",
      ),
    ).toContain("PDF");
    expect(
      validateUpload(new File([], "empty.png", { type: "image/png" }), "image"),
    ).toContain("empty");
    expect(
      validateUpload(
        new File([new Uint8Array(650001)], "large.png", { type: "image/png" }),
        "image",
      ),
    ).toContain("650 KB");
  });
});
