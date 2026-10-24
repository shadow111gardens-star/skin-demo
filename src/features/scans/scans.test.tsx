import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { ReactNode } from "react";
import { ClinicProvider } from "../../store";
import type { ClinicState } from "../../data";
import ScanLibrary from "./ScanLibrary";
import ScanWizard from "./ScanWizard";
import ScanReport from "./ScanReport";
import DoctorReview from "./DoctorReview";
import ScanComparison from "./ScanComparison";
const stored = () =>
  JSON.parse(localStorage.getItem("mmverse-v1")!) as ClinicState;
function page(node: ReactNode, url = "/skin-analysis") {
  render(
    <ClinicProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/skin-analysis" element={node} />
          <Route path="/skin-analysis/compare" element={node} />
          <Route path="/skin-analysis/:scanId/review" element={node} />
          <Route
            path="/skin-analysis/:scanId"
            element={<ScanReport role="Doctor" onCourse={vi.fn()} />}
          />
          <Route
            path="/patients/:patientId"
            element={<h1>Connected patient profile</h1>}
          />
        </Routes>
      </MemoryRouter>
    </ClinicProvider>,
  );
}
describe("skin analysis workflows", () => {
  it("filters the library by patient, status and date then opens the canonical report and profile", async () => {
    const user = userEvent.setup();
    page(<ScanLibrary role="Doctor" onCourse={vi.fn()} />);
    await user.type(screen.getByLabelText("Search scan library"), "Ananya");
    expect(screen.getAllByRole("row")).toHaveLength(3);
    await user.selectOptions(
      screen.getByLabelText("Scan status filter"),
      "Reviewed",
    );
    expect(screen.getAllByRole("row")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Scan date from"), {
      target: { value: "2026-10-01" },
    });
    expect(screen.getByText("No scans in this view")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    await user.click(
      screen.getByRole("button", { name: "Open report skin-analysis-1" }),
    );
    expect(
      screen.getByRole("heading", { name: "Full face analysis report" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Demonstration data · only supplied indices are shown."),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /Ananya Sharma.*MM-1041/ }),
    );
    expect(
      screen.getByRole("heading", { name: "Connected patient profile" }),
    ).toBeInTheDocument();
  });
  it("saves an incomplete draft without fabricating measurements or duplicating a patient", async () => {
    const user = userEvent.setup();
    const saved = vi.fn();
    render(
      <ClinicProvider>
        <ScanWizard
          initialPatientId="MM-1042"
          onClose={vi.fn()}
          onSaved={saved}
        />
      </ClinicProvider>,
    );
    expect(screen.getByLabelText("Patient")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Confirm & save/ }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    const r = stored().records["Skin Analysis"][0];
    expect(r.patientId).toBe("MM-1042");
    expect(r.status).toBe("Draft");
    expect(r.scan?.metrics).toEqual({});
    expect(r.scan?.assets).toEqual([]);
    expect(stored().patients).toHaveLength(6);
    expect(saved).toHaveBeenCalledWith(
      expect.objectContaining({ id: r.id }),
      false,
    );
  });
  it("validates uploads, previews and removes an original, and confirms cancellation", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const close = vi.fn();
    render(
      <ClinicProvider>
        <ScanWizard
          initialPatientId="MM-1041"
          onClose={close}
          onSaved={vi.fn()}
        />
      </ClinicProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    const upload = screen.getByLabelText("Upload demo facial images");
    await user.upload(
      upload,
      new File(["bad"], "payload.exe", { type: "application/octet-stream" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("JPG");
    await user.upload(
      upload,
      new File(["image-demo"], "fictional.png", { type: "image/png" }),
    );
    expect(
      await screen.findByRole("button", { name: "Remove fictional.png" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Original uploaded demo image" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Remove fictional.png" }),
    );
    expect(
      screen.queryByRole("button", { name: "Remove fictional.png" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    const dialog = screen.getByRole("dialog", {
      name: "Discard unsaved scan changes?",
    });
    expect(close).not.toHaveBeenCalled();
    await user.click(
      within(dialog).getByRole("button", { name: "Discard changes" }),
    );
    expect(close).toHaveBeenCalledOnce();
  });
  it("records manual clinician review, persists status/history and returns to the report", async () => {
    const user = userEvent.setup();
    page(
      <DoctorReview role="Doctor" onCourse={vi.fn()} />,
      "/skin-analysis/skin-analysis-1/review",
    );
    await user.selectOptions(
      screen.getByLabelText("Review status"),
      "Reviewed",
    );
    await user.type(
      screen.getByLabelText("Clinician observations"),
      "Discussed the fictional report with the patient.",
    );
    await user.type(
      screen.getByLabelText("Clinician recommendations"),
      "Review at the planned consultation.",
    );
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /Save.*review/i }));
    expect(
      await screen.findByRole("heading", { name: "Full face analysis report" }),
    ).toBeInTheDocument();
    const r = stored().records["Skin Analysis"].find(
      (r) => r.id === "skin-analysis-1",
    )!;
    expect(r.status).toBe("Reviewed");
    expect(r.scan?.reviewHistory).toHaveLength(1);
    expect(r.scan?.recommendations).toContain("planned consultation");
  });
  it("compares same-patient captures, switches image tabs and saves a linked progress note", async () => {
    const user = userEvent.setup();
    page(
      <ScanComparison role="Doctor" />,
      "/skin-analysis/compare?patientId=MM-1041",
    );
    expect(screen.getAllByText(/points$/)).toHaveLength(3);
    await user.selectOptions(
      screen.getByLabelText("Baseline scan"),
      "skin-analysis-1",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("different scans");
    await user.selectOptions(
      screen.getByLabelText("Baseline scan"),
      "scan-history-1041",
    );
    await user.click(screen.getByRole("tab", { name: "Follow-up" }));
    expect(screen.getByRole("tab", { name: "Follow-up" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.type(
      screen.getByLabelText("Progress note"),
      "Reviewed both fictional source reports; discuss at next visit.",
    );
    await user.click(screen.getByRole("checkbox"));
    await user.click(
      screen.getByRole("button", { name: "Save Progress Note" }),
    );
    const doc = stored().records["Clinical Documents"].find(
      (r) => r.scanComparison,
    )!;
    expect(doc.patientId).toBe("MM-1041");
    expect(doc.scanComparison?.baselineId).toBe("scan-history-1041");
    expect(doc.scanComparison?.followupId).toBe("skin-analysis-1");
    expect(stored().activity[0].patientId).toBe("MM-1041");
    await user.selectOptions(
      screen.getByLabelText("Comparison patient"),
      "MM-1043",
    );
    expect(screen.getByText("No comparison available")).toBeInTheDocument();
  });
  it("registers a patient from capture and reuses the resulting ID", async () => {
    const user = userEvent.setup();
    const saved = vi.fn();
    render(
      <ClinicProvider>
        <ScanWizard onClose={vi.fn()} onSaved={saved} />
      </ClinicProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Register patient" }));
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Nisha Capture Demo" },
    });
    fireEvent.change(screen.getByLabelText("Mobile"), {
      target: { value: "9112345678" },
    });
    fireEvent.change(screen.getByLabelText("Date of birth"), {
      target: { value: "1993-06-18" },
    });
    const dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Register patient" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const p = stored().patients.find((p) => p.name === "Nisha Capture Demo")!;
    expect(screen.getByLabelText("Patient")).toHaveValue(p.id);
    await user.click(screen.getByRole("button", { name: /Confirm & save/ }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(stored().records["Skin Analysis"][0].patientId).toBe(p.id);
    expect(stored().patients).toHaveLength(7);
  });
  it("shows review as read-only for technician demo role", () => {
    page(
      <DoctorReview role="Laser Technician" onCourse={vi.fn()} />,
      "/skin-analysis/skin-analysis-1/review",
    );
    expect(
      screen.queryByLabelText("Clinician observations"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View report" }),
    ).toBeInTheDocument();
  });
});
