import { describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { ClinicProvider } from "./store";
import PatientForm from "./features/patients/PatientForm";
import Patients from "./pages/Patients";
import { saveSession } from "./auth";
import { resetState, saveState, type ClinicState } from "./data";
const stored = () =>
  JSON.parse(localStorage.getItem("mmverse-v1")!) as ClinicState;
function form(patient?: ClinicState["patients"][number]) {
  const close = vi.fn(),
    saved = vi.fn(),
    existing = vi.fn();
  render(
    <ClinicProvider>
      <PatientForm
        patient={patient}
        onClose={close}
        onSaved={saved}
        onExisting={existing}
      />
    </ClinicProvider>,
  );
  return { close, saved, existing };
}
async function fillRegistration(
  user: ReturnType<typeof userEvent.setup>,
  mobile = "9123456789",
) {
  await user.type(screen.getByLabelText("Full name"), "Nisha Menon");
  await user.type(screen.getByLabelText("Mobile"), mobile);
  fireEvent.change(screen.getByLabelText("Date of birth"), {
    target: { value: "1993-06-18" },
  });
}
async function openProfile(id = "MM-1042") {
  saveSession(
    { role: "Clinic Owner", name: "Dr. Mehta", email: "demo@mmverse.clinic" },
    true,
  );
  window.history.replaceState({}, "", "/patients/" + id);
  render(<App />);
  await screen.findByRole("heading", {
    name: id === "MM-1042" ? "Rohan Mehta" : "Ananya Sharma",
  });
  return userEvent.setup();
}
describe("patient registration", () => {
  it("registers a uniquely identified patient with calculated age and saved care preferences", async () => {
    const user = userEvent.setup();
    const { saved } = form();
    const id = (screen.getByLabelText("Patient ID") as HTMLInputElement).value;
    await fillRegistration(user);
    await user.type(screen.getByLabelText("Email"), "NISHA@example.test");
    await user.selectOptions(
      screen.getByRole("combobox", { name: /Assigned doctor/ }),
      "Dr. Neha Kapoor",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: /Communication preference/ }),
      "Email",
    );
    expect(screen.getByLabelText("Calculated age")).toHaveValue("33 years");
    await user.click(screen.getByRole("button", { name: "Register patient" }));
    expect(saved).toHaveBeenCalledOnce();
    expect(stored().patients[0]).toMatchObject({
      id,
      name: "Nisha Menon",
      age: 33,
      email: "nisha@example.test",
      assignedDoctor: "Dr. Neha Kapoor",
      communicationPreference: "Email",
      status: "New",
    });
    expect(new Set(stored().patients.map((p) => p.id)).size).toBe(7);
  });
  it("warns about a likely duplicate and opens the existing patient without saving a duplicate", async () => {
    const user = userEvent.setup();
    const { saved, existing } = form();
    await fillRegistration(user, "+91 98765 43210");
    const warning = screen.getByRole("region", {
      name: "Likely duplicate patients",
    });
    expect(warning).toHaveTextContent("Ananya Sharma");
    await user.click(screen.getByRole("button", { name: "Register patient" }));
    expect(saved).not.toHaveBeenCalled();
    expect(stored().patients).toHaveLength(6);
    await user.click(
      within(warning).getByRole("button", { name: "Open existing" }),
    );
    expect(existing).toHaveBeenCalledWith(
      expect.objectContaining({ id: "MM-1041" }),
    );
  });
  it("requires an explicit duplicate acknowledgement before a shared-contact registration", async () => {
    const user = userEvent.setup();
    const { saved } = form();
    await fillRegistration(user, "9876543210");
    await user.click(
      screen.getByLabelText(
        "I reviewed these matches; this is a different person.",
      ),
    );
    await user.click(screen.getByRole("button", { name: "Register patient" }));
    expect(saved).toHaveBeenCalledOnce();
    expect(stored().patients).toHaveLength(7);
  });
  it("shows inline validation and cancels without persisting a draft", async () => {
    const user = userEvent.setup();
    const { close, saved } = form();
    await user.type(screen.getByLabelText("Full name"), "Draft");
    await user.type(screen.getByLabelText("Email"), "invalid-email");
    await user.click(screen.getByRole("button", { name: "Register patient" }));
    expect(
      screen.getByText("Enter a valid email address, or leave this blank."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Mobile")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(saved).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(close).toHaveBeenCalledOnce();
    expect(stored().patients).toHaveLength(6);
  });
  it("edits the existing patient ID and keeps linked record names up to date", async () => {
    const user = userEvent.setup();
    form(resetState().patients[0]);
    const input = screen.getByLabelText("Full name");
    await user.clear(input);
    await user.type(input, "Ananya Demo Sharma");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(stored().patients).toHaveLength(6);
    expect(stored().patients.find((p) => p.id === "MM-1041")?.name).toBe(
      "Ananya Demo Sharma",
    );
    expect(stored().records["Payments"][0].name).toBe("Ananya Demo Sharma");
  });
});
describe("patient directory", () => {
  it("searches normalized mobile, combines care filters, sorts and resets", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ClinicProvider>
          <Patients
            role="Clinic Owner"
            onPatient={vi.fn()}
            onCreate={vi.fn()}
            onBook={vi.fn()}
          />
        </ClinicProvider>
      </MemoryRouter>,
    );
    const table = screen.getByRole("table", { name: "Patient directory" });
    expect(within(table).getAllByRole("row")).toHaveLength(7);
    await user.type(
      screen.getByLabelText("Search patients"),
      "+91 98765 43211",
    );
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(table).toHaveTextContent("Rohan Mehta");
    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    await user.selectOptions(screen.getByLabelText("Patient status"), "Active");
    await user.selectOptions(
      screen.getByLabelText("Patient treatment"),
      "PRP hair restoration",
    );
    await user.selectOptions(
      screen.getByLabelText("Assigned doctor filter"),
      "Dr. Neha Kapoor",
    );
    await user.selectOptions(
      screen.getByLabelText("Next visit filter"),
      "Today",
    );
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    await user.selectOptions(
      screen.getByLabelText("Sort patients"),
      "Balance: high to low",
    );
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent(
      "Rohan Mehta",
    );
  });
  it("paginates larger directories and changes the page limit", async () => {
    const state = resetState();
    for (let i = 0; i < 15; i++)
      state.patients.push({
        ...state.patients[0],
        id: "TEST-" + i,
        name: "Test Patient " + i,
      });
    saveState(state);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ClinicProvider>
          <Patients
            role="Clinic Owner"
            onPatient={vi.fn()}
            onCreate={vi.fn()}
            onBook={vi.fn()}
          />
        </ClinicProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      11,
    );
    await user.click(
      screen.getByRole("button", { name: "Next patients page" }),
    );
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Patients per page"), "25");
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      22,
    );
  });
});
describe("Patient 360", () => {
  it("navigates every profile section without changing patient identity", async () => {
    const user = await openProfile();
    const nav = screen.getByRole("navigation", {
      name: "Patient profile sections",
    });
    for (const tab of [
      "Clinical History",
      "Skin Analysis",
      "Treatment Courses",
      "Sessions",
      "Photos",
      "Appointments",
      "Consents & Documents",
      "Packages & Payments",
      "Activity",
      "Overview",
    ]) {
      await user.click(within(nav).getByRole("button", { name: tab }));
      expect(
        screen.getByRole("region", { name: tab + " content" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Rohan Mehta" }),
      ).toBeInTheDocument();
      expect(window.location.pathname).toBe("/patients/MM-1042");
    }
  }, 60000);
  it("prefills and locks the same patient in all seven quick actions", async () => {
    const user = await openProfile();
    const group = screen.getByRole("group", { name: "Patient quick actions" });
    const actions = [
      ["Book appointment", "Book appointment"],
      ["Start consultation", "Start consultation"],
      ["Add skin scan", "Create skin scan"],
      ["Create treatment plan", "Create treatment plan"],
      ["Record sitting", "Record sitting"],
      ["Schedule follow-up", "Schedule follow-up"],
      ["Record payment", "Record demo payment"],
    ];
    for (const [label, title] of actions) {
      await user.click(within(group).getByRole("button", { name: label }));
      const dialog = screen.getByRole("dialog", { name: title });
      expect(await within(dialog).findByLabelText("Patient")).toHaveValue(
        "MM-1042",
      );
      expect(within(dialog).getByLabelText("Patient")).toBeDisabled();
      if (label === "Book appointment") {
        await user.click(
          within(dialog).getByRole("button", { name: "Continue" }),
        );
        expect(within(dialog).getByLabelText("Doctor")).toHaveValue(
          "Dr. Neha Kapoor",
        );
      }
      if (label === "Create treatment plan")
        expect(
          within(dialog).getByLabelText("Source consultation"),
        ).toHaveValue("");
      if (label === "Record payment")
        expect(within(dialog).getByLabelText("Invoice amount")).toHaveValue(
          "24000",
        );
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    }
    expect(stored().patients).toHaveLength(6);
  }, 60000);
  it("creates a consultation and follow-up under the existing patient record", async () => {
    const user = await openProfile();
    const group = screen.getByRole("group", { name: "Patient quick actions" });
    await user.click(
      within(group).getByRole("button", { name: "Start consultation" }),
    );
    await user.type(
      screen.getByLabelText("Presenting concern"),
      "Hair restoration progress review",
    );
    await user.click(screen.getByRole("button", { name: "Save Draft" }));
    expect(stored().records["Consultations"][0].patientId).toBe("MM-1042");
    await user.click(
      within(group).getByRole("button", { name: "Schedule follow-up" }),
    );
    await user.type(
      screen.getByLabelText("Follow-up reason"),
      "Recovery check after PRP sitting",
    );
    await user.click(screen.getByRole("button", { name: "Save record" }));
    expect(stored().records["Follow-ups"][0]).toMatchObject({
      patientId: "MM-1042",
      dueDate: "2026-10-25",
    });
    expect(stored().patients).toHaveLength(6);
    await user.click(screen.getByRole("button", { name: "Activity" }));
    expect(
      screen.getByRole("region", { name: "Activity content" }),
    ).toHaveTextContent("Rohan Mehta");
  });
  it("confirms archive and restores the patient while retaining every linked record", async () => {
    const user = await openProfile();
    const count = stored().appointments.length;
    await user.click(screen.getByRole("button", { name: "Archive patient" }));
    expect(stored().patients.find((p) => p.id === "MM-1042")?.status).toBe(
      "Active",
    );
    await user.click(screen.getByRole("button", { name: "Confirm archive" }));
    expect(stored().patients.find((p) => p.id === "MM-1042")?.status).toBe(
      "Archived",
    );
    expect(stored().appointments).toHaveLength(count);
    await user.click(screen.getByRole("button", { name: "Restore patient" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Restore patient" })).getByRole(
        "button",
        { name: "Restore patient" },
      ),
    );
    await waitFor(() =>
      expect(stored().patients.find((p) => p.id === "MM-1042")?.status).toBe(
        "Active",
      ),
    );
  });
});
it("records an existing sitting and a payment without creating another patient or session", async () => {
  const user = await openProfile();
  const count = stored().records["Sittings & Sessions"].length;
  const group = screen.getByRole("group", { name: "Patient quick actions" });
  await user.click(
    within(group).getByRole("button", { name: "Record sitting" }),
  );
  await user.selectOptions(screen.getByLabelText("Appointment"), "APT-202");
  expect(screen.getByLabelText("Patient")).toHaveValue("MM-1042");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(stored().records["Sittings & Sessions"]).toHaveLength(count);
  expect(stored().appointments.find((a) => a.id === "APT-202")?.status).toBe(
    "In progress",
  );
  expect(
    stored().records["Treatment Plans"].find((r) => r.id === "course-MM-1042")
      ?.completedSittings,
  ).toBe(2);
  await user.click(
    within(group).getByRole("button", { name: "Record payment" }),
  );
  await user.click(
    screen.getByLabelText("I understand this records a simulated payment only"),
  );
  await user.click(screen.getByRole("button", { name: "Save demo payment" }));
  expect(
    stored().records["Packages & Billing"].find(
      (r) => r.patientId === "MM-1042",
    )?.status,
  ).toBe("Paid");
  expect(
    stored()
      .records["Payments"].filter((r) => r.patientId === "MM-1042")
      .reduce((n, r) => n + r.amount, 0),
  ).toBe(24000);
  expect(stored().patients).toHaveLength(6);
}, 60000);
it("updates clinician-reviewed history and exposes the reviewed alert on the same profile", async () => {
  const user = await openProfile();
  await user.click(
    within(
      screen.getByRole("navigation", { name: "Patient profile sections" }),
    ).getByRole("button", { name: "Clinical History" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Edit clinical history" }),
  );
  const dialog = screen.getByRole("dialog", {
    name: "Review clinical history",
  });
  await user.type(
    within(dialog).getByLabelText("Important alerts (one per line)"),
    "Review documented precautions before each sitting.",
  );
  await user.click(
    within(dialog).getByLabelText(
      "The treating clinician has reviewed this history and these alerts.",
    ),
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Save reviewed history" }),
  );
  expect(
    stored().patients.find((p) => p.id === "MM-1042")?.clinical?.reviewedBy,
  ).toBe("Dr. Neha Kapoor");
  expect(
    screen.getByText("Important clinician-reviewed alert"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Review documented precautions before each sitting."),
  ).toBeInTheDocument();
});
it("saves a consent-recorded photo and confirms deletion from local patient records", async () => {
  const user = await openProfile();
  await user.click(
    within(
      screen.getByRole("navigation", { name: "Patient profile sections" }),
    ).getByRole("button", { name: "Photos" }),
  );
  await user.click(screen.getByRole("button", { name: "Add demo photo" }));
  await user.type(screen.getByLabelText("Photo title"), "Baseline demo view");
  const image = new File(
    [
      Uint8Array.from(
        atob(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1sAAAAASUVORK5CYII=",
        ),
        (c) => c.charCodeAt(0),
      ),
    ],
    "demo.png",
    { type: "image/png" },
  );
  await user.upload(screen.getByLabelText(/Image \(JPG/), image);
  await user.click(
    screen.getByLabelText("Consent for this fictional photo is recorded."),
  );
  await user.click(screen.getByRole("button", { name: "Save demo photo" }));
  await waitFor(() => expect(stored().records["Photos"]).toHaveLength(1));
  expect(stored().records["Photos"][0].patientId).toBe("MM-1042");
  expect(stored().records["Photos"][0].imageUrl).toContain(
    "data:image/png;base64,",
  );
  await user.click(screen.getByRole("button", { name: "Baseline demo view" }));
  await user.click(screen.getByRole("button", { name: "Delete photo" }));
  expect(stored().records["Photos"]).toHaveLength(1);
  await user.click(
    within(screen.getByRole("dialog", { name: "Delete demo photo" })).getByRole(
      "button",
      { name: "Delete photo" },
    ),
  );
  expect(stored().records["Photos"]).toHaveLength(0);
}, 60000);
