import { beforeEach, describe, it, expect } from "vitest";
import {
  render,
  screen,
  within,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useParams } from "react-router-dom";
import { ClinicProvider } from "../../store";
import { resetState, saveState, readState, type ClinicState } from "../../data";
import Sessions from "./Sessions";
import SessionWorkspace from "./SessionWorkspace";
import { preparedSession, sessionRecord } from "./testFixtures";
const stored = () => readState();
function Target() {
  const p = useParams();
  return <h1>Linked record {p.id}</h1>;
}
function mount(
  s: ClinicState,
  path: string,
  role: "Doctor" | "Receptionist" = "Doctor",
) {
  saveState(s);
  return render(
    <ClinicProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/sittings-sessions"
            element={<Sessions role={role} onCreate={() => {}} />}
          />
          <Route
            path="/sittings-sessions/:sessionId"
            element={<SessionWorkspace role={role} />}
          />
          <Route path="/patients/:id" element={<Target />} />
          <Route path="/treatment-plans/courses/:id" element={<Target />} />
        </Routes>
      </MemoryRouter>
    </ClinicProvider>,
  );
}
beforeEach(() => localStorage.clear());
async function confirmStatus(
  user: ReturnType<typeof userEvent.setup>,
  button: string,
) {
  await user.click(screen.getByRole("button", { name: button }));
  const dialog = screen.getByRole("dialog");
  await user.click(
    within(dialog).getByRole("button", { name: "Confirm Status" }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
}
describe("session workspace interactions", () => {
  it("records and completes a sitting through all steps, compares previous parameters and updates the shared package", async () => {
    const user = userEvent.setup(),
      s = preparedSession(),
      r = sessionRecord(s),
      prior = sessionRecord(s, "APT-201");
    prior.session!.parameterSchema = r.session!.parameterSchema;
    prior.session!.machineId = r.session!.machineId;
    prior.session!.parameters = { "test-energy": "10" };
    prior.session!.reaction = "None observed";
    r.session!.parameters = {};
    r.session!.checks = {
      identity: false,
      history: false,
      parameters: false,
      machine: false,
    };
    r.session!.parameterApprovalBy = "";
    r.session!.parameterApprovalNote = "";
    r.session!.parameterApprovedAt = undefined;
    mount(s, "/sittings-sessions/" + r.id);
    expect(screen.getByLabelText("Patient ID")).toHaveValue("MM-1041");
    await user.click(
      screen.getByLabelText(/Patient identity and linked appointment/),
    );
    await user.click(
      screen.getByLabelText(/Clinician-reviewed alerts, allergies/),
    );
    await user.click(
      screen.getByLabelText(/Selected machine and treatment room/),
    );
    await confirmStatus(user, "Check In");
    await confirmStatus(user, "Begin Preparation");
    await user.click(
      screen.getByRole("button", { name: /2 Device & parameters/ }),
    );
    expect(screen.getByLabelText("Test energy entry")).toHaveValue(null);
    await user.click(
      screen.getByRole("button", { name: /Compare recorded parameters/ }),
    );
    const compare = screen.getByRole("dialog", {
      name: "Previous sitting comparison",
    });
    expect(within(compare).getByText("10")).toBeInTheDocument();
    expect(within(compare).getByText("Not recorded")).toBeInTheDocument();
    await user.click(within(compare).getByRole("button", { name: "Close" }));
    await user.type(screen.getByLabelText("Test energy entry"), "12");
    await user.selectOptions(
      screen.getByLabelText("Parameter approving clinician"),
      "Dr. Mehta",
    );
    await user.type(
      screen.getByLabelText("Parameter approval note"),
      "Clinic-entered test review reference",
    );
    await user.click(screen.getByLabelText(/These documented parameters/));
    await confirmStatus(user, "Start Session");
    expect(sessionRecord(stored()).status).toBe("In Progress");
    await user.click(
      screen.getByRole("button", { name: /3 Procedure record/ }),
    );
    for (const [label, text] of [
      ["Procedure notes", "Procedure recorded"],
      ["Consumables used", "Clinic stock item"],
      ["Patient tolerance", "Patient report documented"],
      ["Observed response", "Observed findings documented"],
      ["Aftercare instructions", "Instructions entered by clinician"],
      ["Technician notes", "Operator documentation complete"],
    ])
      await user.type(screen.getByLabelText(label), text);
    await user.selectOptions(
      screen.getByLabelText("Adverse reaction assessment"),
      "None observed",
    );
    await user.click(screen.getByRole("button", { name: "Save Draft" }));
    expect(sessionRecord(stored()).session!.procedureNotes).toBe(
      "Procedure recorded",
    );
    expect(stored().sessionCompletions).toHaveLength(0);
    await confirmStatus(user, "Submit for Review");
    await user.click(
      screen.getByRole("button", { name: /4 Review & next steps/ }),
    );
    await user.type(
      screen.getByLabelText("Doctor review"),
      "Clinician reviewed the complete record",
    );
    fireEvent.change(screen.getByLabelText("Recommended next date"), {
      target: { value: "2026-11-20" },
    });
    await user.click(screen.getByRole("button", { name: "Complete Sitting" }));
    const dialog = screen.getByRole("dialog", {
      name: "Confirm clinician completion",
    });
    await user.type(
      within(dialog).getByLabelText("Session action note"),
      "Completion confirmed by Dr. Mehta",
    );
    await user.click(within(dialog).getByLabelText(/I reviewed the procedure/));
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm Completion" }),
    );
    await waitFor(() =>
      expect(sessionRecord(stored()).status).toBe("Completed"),
    );
    expect(
      stored().records["Treatment Plans"].find((c) => c.id === r.courseId)
        ?.completedSittings,
    ).toBe(5);
    expect(stored().sessionCompletions).toHaveLength(1);
    expect(
      stored().records["Packages & Billing"].find(
        (i) => i.courseId === r.courseId,
      )?.packageSessions?.remaining,
    ).toBe(1);
    expect(
      stored().records["Follow-ups"].some(
        (f) => f.sessionId === r.id && f.dueDate === "2026-11-20",
      ),
    ).toBe(true);
    expect(
      screen.queryByRole("button", { name: "Complete Sitting" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Doctor review")).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: "Laser Hair Reduction" }),
    );
    expect(
      await screen.findByRole("heading", {
        name: "Linked record course-MM-1041",
      }),
    ).toBeInTheDocument();
  }, 60000);
  it("filters queue views, date, treatment, machine and technician, resets and opens the existing patient", async () => {
    const user = userEvent.setup(),
      s = resetState();
    mount(s, "/sittings-sessions");
    const table = screen.getByRole("table", { name: "Session queue" });
    expect(within(table).getAllByRole("row")).toHaveLength(7);
    await user.type(screen.getByLabelText("Search sessions"), "MM-1042");
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    await user.click(
      within(
        screen.getByRole("navigation", { name: "Session views" }),
      ).getByRole("button", { name: "Upcoming" }),
    );
    expect(within(table).getByText("Kavya Nair")).toBeInTheDocument();
    await user.click(
      within(
        screen.getByRole("navigation", { name: "Session views" }),
      ).getByRole("button", { name: "Today" }),
    );
    await user.selectOptions(
      screen.getByLabelText("Session machine filter"),
      s.appointments.find((a) => a.id === "APT-206")!.machineId!,
    );
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    await user.selectOptions(
      screen.getByLabelText("Session technician filter"),
      s.appointments.find((a) => a.id === "APT-206")!.technician!,
    );
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    await user.selectOptions(
      screen.getByLabelText("Session treatment filter"),
      "HydraFacial",
    );
    expect(
      within(table).getByText("No sittings in this view"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    await user.click(
      within(table).getByRole("button", { name: /Priya Patel/ }),
    );
    expect(
      await screen.findByRole("heading", { name: "Linked record MM-1043" }),
    ).toBeInTheDocument();
  });
  it("retains a draft after reload, rejects bad uploads and lets receptionist cancel without consuming a unit", async () => {
    const user = userEvent.setup(),
      s = resetState(),
      r = sessionRecord(s),
      view = mount(s, "/sittings-sessions/" + r.id);
    await user.click(
      screen.getByRole("button", { name: /3 Procedure record/ }),
    );
    fireEvent.change(screen.getByLabelText("Upload before images"), {
      target: {
        files: [new File(["bad"], "report.txt", { type: "text/plain" })],
      },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /PNG|JPG|JPEG|WebP/i,
    );
    await user.type(
      screen.getByLabelText("Procedure notes"),
      "Draft retained across reload",
    );
    await user.click(screen.getByRole("button", { name: "Save Draft" }));
    view.unmount();
    mount(stored(), "/sittings-sessions/" + r.id, "Receptionist");
    await user.click(
      screen.getByRole("button", { name: /3 Procedure record/ }),
    );
    expect(screen.getByLabelText("Procedure notes")).toHaveValue(
      "Draft retained across reload",
    );
    expect(
      screen.queryByRole("button", { name: "Save Draft" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel Sitting" }));
    const dialog = screen.getByRole("dialog");
    await user.type(
      within(dialog).getByLabelText("Session action note"),
      "Patient requested cancellation",
    );
    await user.click(within(dialog).getByLabelText(/Confirm this change/));
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm Status" }),
    );
    expect(sessionRecord(stored()).status).toBe("Cancelled");
    expect(stored().sessionCompletions).toHaveLength(0);
    expect(
      stored().records["Treatment Plans"].find((c) => c.id === r.courseId)
        ?.completedSittings,
    ).toBe(4);
  });
  it("configures device fields with clinician-entered units and leaves parameter values empty", async () => {
    const user = userEvent.setup(),
      s = resetState(),
      r = sessionRecord(s);
    mount(s, "/sittings-sessions/" + r.id);
    await user.click(
      screen.getByRole("button", { name: /2 Device & parameters/ }),
    );
    expect(
      screen.getByText("Device documentation not configured"),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Configure fields & units" }),
    );
    const dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Save configuration" }),
    );
    expect(within(dialog).getByRole("alert")).toBeInTheDocument();
    await user.type(
      within(dialog).getByLabelText("Device documentation source"),
      "Fictional clinic verified documentation",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Add documentation field" }),
    );
    await user.type(
      within(dialog).getByLabelText("Parameter field label 1"),
      "Operator recorded entry",
    );
    await user.type(
      within(dialog).getByLabelText("Parameter field unit 1"),
      "clinic recorded units",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Save configuration" }),
    );
    expect(screen.getByLabelText("Operator recorded entry")).toHaveValue(null);
    expect(screen.getByText("clinic recorded units")).toBeInTheDocument();
    expect(sessionRecord(stored()).session!.parameters).toEqual({});
  });
  it("reschedules through confirmation without consuming a sitting and opens course record links", async () => {
    const user = userEvent.setup(),
      s = resetState(),
      r = sessionRecord(s);
    mount(s, "/sittings-sessions/" + r.id);
    await user.click(screen.getByRole("button", { name: "Reschedule" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Action date"), {
      target: { value: "2026-10-24" },
    });
    fireEvent.change(within(dialog).getByLabelText("Action time"), {
      target: { value: "16:00" },
    });
    await user.type(
      within(dialog).getByLabelText("Session action note"),
      "Patient requested another date",
    );
    await user.click(within(dialog).getByLabelText(/Confirm this change/));
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm Reschedule" }),
    );
    expect(sessionRecord(stored()).date).toBe("2026-10-24");
    expect(stored().sessionCompletions).toHaveLength(0);
    expect(
      stored().records["Treatment Plans"].find((c) => c.id === r.courseId)
        ?.completedSittings,
    ).toBe(4);
    await user.click(screen.getByRole("button", { name: "Session queue" }));
    expect(
      screen.getByRole("heading", { name: "Sittings & Sessions" }),
    ).toBeInTheDocument();
  });
  it("withholds values recorded under a changed device schema until explicitly cleared", async () => {
    const user = userEvent.setup(),
      s = preparedSession(),
      r = sessionRecord(s),
      m = s.records["Machines & Equipment"].find(
        (m) => m.id === r.session!.machineId,
      )!;
    m.deviceDocumentation = {
      ...m.deviceDocumentation!,
      version: 2,
      fields: m.deviceDocumentation!.fields.map((f) => ({
        ...f,
        unit: "new test units",
      })),
    };
    mount(s, "/sittings-sessions/" + r.id);
    await user.click(
      screen.getByRole("button", { name: /2 Device & parameters/ }),
    );
    expect(
      screen.getByText("Device documentation changed"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Test energy entry")).toHaveValue(null);
    expect(screen.getByLabelText("Test energy entry")).toBeDisabled();
    await user.click(
      screen.getByRole("button", {
        name: "Clear prior settings for new configuration",
      }),
    );
    expect(screen.getByLabelText("Test energy entry")).toBeEnabled();
    expect(screen.getByLabelText("Test energy entry")).toHaveValue(null);
    await user.click(screen.getByRole("button", { name: "Save Draft" }));
    expect(sessionRecord(stored()).session!.parameters).toEqual({});
    expect(sessionRecord(stored()).session!.checks.parameters).toBe(false);
  });
});
