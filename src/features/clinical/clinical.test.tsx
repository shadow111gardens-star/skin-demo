import { describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  within,
  cleanup,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ClinicProvider } from "../../store";
import { resetState, saveState, type ClinicState } from "../../data";
import Consultations, { ConsultationForm } from "./Consultations";
import TreatmentCatalogue from "./TreatmentCatalogue";
import TreatmentPlans from "./TreatmentPlans";
import PlanBuilder from "./PlanBuilder";
import CourseDetail from "./CourseDetail";
const stored = () =>
  JSON.parse(localStorage.getItem("mmverse-v1")!) as ClinicState;
function routes(url: string) {
  render(
    <ClinicProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route
            path="/consultations/:consultationId"
            element={<Consultations role="Doctor" />}
          />
          <Route
            path="/consultations"
            element={<Consultations role="Doctor" />}
          />
          <Route
            path="/treatment-plans/courses/:courseId"
            element={<CourseDetail role="Clinic Owner" onCreate={vi.fn()} />}
          />
          <Route
            path="/treatment-plans/:planId"
            element={<TreatmentPlans role="Doctor" />}
          />
          <Route
            path="/treatment-plans"
            element={<TreatmentPlans role="Doctor" />}
          />
          <Route
            path="/patients/:patientId"
            element={<h1>Connected patient profile</h1>}
          />
          <Route
            path="/treatment-catalogue"
            element={<TreatmentCatalogue role="Clinic Owner" />}
          />
        </Routes>
      </MemoryRouter>
    </ClinicProvider>,
  );
}
describe("clinical workspaces", () => {
  it("persists and resumes a consultation draft, validates submission and keeps patient context", async () => {
    const user = userEvent.setup(),
      saved = vi.fn();
    render(
      <ClinicProvider>
        <ConsultationForm
          initialPatientId="MM-1041"
          onClose={vi.fn()}
          onSaved={saved}
        />
      </ClinicProvider>,
    );
    expect(screen.getByLabelText("Patient")).toBeDisabled();
    expect(screen.getByText("Allergies")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Presenting concern"), {
      target: { value: "Fictional concern for clinician discussion" },
    });
    fireEvent.change(screen.getByLabelText("Previous reactions"), {
      target: { value: "None reported in this fictional consultation" },
    });
    await user.click(screen.getByRole("button", { name: "Save Draft" }));
    const draft = stored().records.Consultations[0];
    expect(draft.status).toBe("Draft");
    expect(draft.patientId).toBe("MM-1041");
    expect(stored().patients).toHaveLength(6);
    cleanup();
    render(
      <ClinicProvider>
        <ConsultationForm existing={draft} onClose={vi.fn()} onSaved={saved} />
      </ClinicProvider>,
    );
    expect(screen.getByLabelText("Presenting concern")).toHaveValue(
      "Fictional concern for clinician discussion",
    );
    await user.click(
      screen.getByRole("button", { name: "Submit for Review/Approval" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Complete concern");
    fireEvent.change(screen.getByLabelText("Duration of concern"), {
      target: { value: "Three months" },
    });
    fireEvent.change(screen.getByLabelText("Examination observations"), {
      target: { value: "Fictional examination recorded by the clinician" },
    });
    fireEvent.change(screen.getByLabelText("Clinician assessment"), {
      target: { value: "Patient-specific assessment entered by clinician" },
    });
    await user.selectOptions(
      screen.getByLabelText("Treatment"),
      stored().records["Treatment Catalogue"][0].id,
    );
    fireEvent.change(screen.getByLabelText("Treatment area"), {
      target: { value: "Lower legs" },
    });
    await user.click(
      screen.getByRole("button", { name: "Submit for Review/Approval" }),
    );
    expect(
      stored().records.Consultations.find((c) => c.id === draft.id)?.status,
    ).toBe("Awaiting Review");
    expect(
      stored().records.Consultations.filter((c) => c.id === draft.id),
    ).toHaveLength(1);
  });
  it("records explicit consultation review and links to the patient and builder", async () => {
    const user = userEvent.setup(),
      s = resetState();
    const c = s.records.Consultations.find(
      (c) => c.id === "consult-proposal-MM-1043",
    )!;
    c.status = "Awaiting Review";
    saveState(s);
    routes("/consultations/" + c.id);
    await user.click(
      screen.getByRole("button", { name: "Review consultation" }),
    );
    const review = screen.getByRole("dialog", {
      name: "Clinician consultation review",
    });
    fireEvent.change(
      within(review).getByLabelText("Consultation review note"),
      {
        target: {
          value: "Reviewed the fictional history, examination and decision.",
        },
      },
    );
    await user.click(within(review).getByRole("checkbox"));
    await user.click(
      within(review).getByRole("button", { name: "Mark Reviewed" }),
    );
    expect(
      stored().records.Consultations.find((r) => r.id === c.id)?.status,
    ).toBe("Reviewed");
    await user.click(
      screen.getByRole("button", { name: "Create treatment plan" }),
    );
    expect(
      screen.getByRole("heading", { name: "New treatment plan" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Source consultation")).toHaveValue(c.id);
    expect(screen.getByLabelText("Patient")).toHaveValue("MM-1043");
  });
  it("searches the ten-treatment catalogue and persists edited clinic defaults", async () => {
    const user = userEvent.setup();
    routes("/treatment-catalogue");
    expect(stored().records["Treatment Catalogue"]).toHaveLength(10);
    fireEvent.change(screen.getByLabelText("Search treatments"), {
      target: { value: "Laser Hair" },
    });
    await user.click(
      screen.getByText("Laser Hair Reduction").closest("button")!,
    );
    await user.click(screen.getByRole("button", { name: "Edit defaults" }));
    const form = screen.getByRole("dialog", {
      name: "Edit treatment defaults",
    });
    fireEvent.change(
      within(form).getByLabelText("Recommended interval (days)"),
      { target: { value: "35" } },
    );
    fireEvent.change(within(form).getByLabelText("Individual price (INR)"), {
      target: { value: "4200" },
    });
    await user.click(
      within(form).getByRole("button", { name: "Save treatment" }),
    );
    expect(
      stored().records["Treatment Catalogue"].find(
        (t) => t.name === "Laser Hair Reduction",
      )?.treatment,
    ).toMatchObject({ intervalDays: 35, individualPrice: 4200 });
  });
  it("builds from the same patient assessment and recalculates package and individual estimates", async () => {
    const user = userEvent.setup(),
      saved = vi.fn();
    render(
      <ClinicProvider>
        <PlanBuilder
          initialPatientId="MM-1043"
          onClose={vi.fn()}
          onSaved={saved}
        />
      </ClinicProvider>,
    );
    await user.selectOptions(
      screen.getByLabelText("Source consultation"),
      "consult-proposal-MM-1043",
    );
    expect(screen.getByText("₹6,480")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Clinician-approved sessions"), {
      target: { value: "5" },
    });
    expect(screen.getByText("₹8,100")).toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText("Package option"),
      "individual",
    );
    expect(screen.getByText("₹9,000")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Clinician plan note"), {
      target: { value: "Patient-specific configuration proposed for review." },
    });
    await user.click(
      screen.getByRole("button", { name: "Submit for Approval" }),
    );
    const r = stored().records["Plan Proposals"][0];
    expect(r.status).toBe("Awaiting Approval");
    expect(r.amount).toBe(9000);
    expect(r.plan?.assessment).toContain("Clinician-entered");
    expect(r.patientId).toBe("MM-1043");
    expect(stored().records["Treatment Plans"]).toHaveLength(3);
  });
  it("approves and converts one plan, then navigates the real course timeline", async () => {
    const user = userEvent.setup();
    routes("/treatment-plans/proposal-MM-1043");
    await user.click(screen.getByRole("button", { name: "Approve plan" }));
    const approval = screen.getByRole("dialog", {
      name: "Approve treatment plan?",
    });
    await user.selectOptions(
      within(approval).getByLabelText("Approving doctor"),
      "Dr. Mehta",
    );
    await user.click(within(approval).getByRole("checkbox"));
    await user.click(
      within(approval).getByRole("button", { name: "Confirm approval" }),
    );
    expect(
      stored().records["Plan Proposals"].find(
        (r) => r.id === "proposal-MM-1043",
      )?.status,
    ).toBe("Approved");
    await user.click(screen.getByRole("button", { name: "Convert to Course" }));
    await user.click(screen.getByRole("button", { name: "Create course" }));
    expect(
      screen.getByRole("heading", { name: "Acne Treatment" }),
    ).toBeInTheDocument();
    expect(
      stored().records["Treatment Plans"].filter(
        (c) => c.course?.planId === "proposal-MM-1043",
      ),
    ).toHaveLength(1);
    const journey = screen.getByRole("navigation", {
      name: "Treatment journey",
    });
    await user.click(
      within(journey).getByRole("button", { name: /Package Purchased/ }),
    );
    expect(
      screen.getByRole("dialog", { name: "Related course record" }),
    ).toHaveTextContent("Pending");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }),
    );
    await user.click(
      within(journey).getByRole("button", { name: /Consultation/ }),
    );
    expect(
      screen.getByRole("heading", { name: /Priya Patel.*consultation/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /PP Priya Patel/ }));
    expect(
      screen.getByRole("heading", { name: "Connected patient profile" }),
    ).toBeInTheDocument();
  });
  it("preserves the Dashboard active-course preset", () => {
    routes("/treatment-plans?status=Active");
    expect(screen.getByRole("tab", { name: /Courses/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByLabelText("Plan status filter")).toHaveValue("Active");
    expect(screen.getAllByRole("button", { name: "Open course" })).toHaveLength(
      2,
    );
  });
  it("confirms course pause/resume and blocks premature completion", async () => {
    const user = userEvent.setup();
    routes("/treatment-plans/courses/course-MM-1041");
    await user.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.change(screen.getByLabelText("Course status reason"), {
      target: { value: "Patient requested a temporary pause" },
    });
    await user.click(screen.getByRole("button", { name: "Confirm pause" }));
    expect(
      stored().records["Treatment Plans"].find((c) => c.id === "course-MM-1041")
        ?.status,
    ).toBe("Paused");
    await user.click(screen.getByRole("button", { name: "Resume" }));
    fireEvent.change(screen.getByLabelText("Course status reason"), {
      target: { value: "Clinician confirmed resumption" },
    });
    await user.click(screen.getByRole("button", { name: "Confirm resume" }));
    await user.click(screen.getByRole("button", { name: "Complete course" }));
    fireEvent.change(screen.getByLabelText("Course status reason"), {
      target: { value: "Review completion status" },
    });
    await user.click(
      screen.getByRole("button", { name: "Confirm completion" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Complete all planned sessions",
    );
    expect(
      stored().records["Treatment Plans"].find((c) => c.id === "course-MM-1041")
        ?.completedSittings,
    ).toBe(4);
  });
  it("confirms operational course completion after all planned sittings", async () => {
    const user = userEvent.setup(),
      s = resetState(),
      r = s.records["Treatment Plans"].find((c) => c.id === "course-MM-1041")!;
    r.status = "Completed";
    r.completedSittings = r.totalSittings;
    r.course!.completionConfirmed = false;
    saveState(s);
    routes("/treatment-plans/courses/" + r.id);
    await user.click(
      screen.getByRole("button", { name: "Confirm course completion" }),
    );
    fireEvent.change(screen.getByLabelText("Course status reason"), {
      target: { value: "All completed sittings checked by the clinician" },
    });
    await user.click(
      screen.getByRole("button", { name: "Confirm completion" }),
    );
    expect(
      stored().records["Treatment Plans"].find((c) => c.id === r.id)?.course
        ?.completionConfirmed,
    ).toBe(true);
    expect(
      screen.queryByRole("button", { name: "Confirm course completion" }),
    ).not.toBeInTheDocument();
  });
});
