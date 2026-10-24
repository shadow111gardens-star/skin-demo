import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ClinicProvider } from "../../store";
import {
  resetState,
  saveState,
  readState,
  DEMO_DATE,
  type ClinicState,
} from "../../data";
import Appointments from "../../pages/Appointments";
import Followups from "./Followups";
import AppointmentForm from "./AppointmentForm";
const stored = () => readState();
function mount(s: ClinicState, path = "/appointments") {
  saveState(s);
  return render(
    <ClinicProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/appointments"
            element={
              <Appointments
                role="Clinic Owner"
                onPatient={() => {}}
                onCourse={() => {}}
                onCreate={() => {}}
              />
            }
          />
          <Route
            path="/follow-ups"
            element={<Followups role="Clinic Owner" />}
          />
          <Route
            path="/patients/:id"
            element={<h1>Existing patient profile</h1>}
          />
          <Route
            path="/sittings-sessions/:id"
            element={<h1>Existing session workspace</h1>}
          />
        </Routes>
      </MemoryRouter>
    </ClinicProvider>,
  );
}
async function continueBooking(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Continue" }));
}
beforeEach(() => localStorage.clear());
describe("calendar and booking workspace", () => {
  it("creates a patient-linked booking only after availability review and explicit confirmation", async () => {
    const user = userEvent.setup(),
      s = resetState();
    saveState(s);
    render(
      <ClinicProvider>
        <AppointmentForm initialPatientId="MM-1046" onClose={() => {}} />
      </ClinicProvider>,
    );
    await user.selectOptions(
      screen.getByLabelText("Treatment"),
      "Chemical Peel",
    );
    await user.clear(screen.getByLabelText("Duration (minutes)"));
    await user.type(screen.getByLabelText("Duration (minutes)"), "45");
    await continueBooking(user);
    fireEvent.change(screen.getByLabelText("Time (IST)"), {
      target: { value: "14:00" },
    });
    await user.selectOptions(screen.getByLabelText("Doctor"), "Dr. Mehta");
    await user.selectOptions(screen.getByLabelText("Technician"), "Neha Rao");
    await user.selectOptions(screen.getByLabelText("Room"), "Room 03");
    expect(
      screen.getByText("Selected resources are available"),
    ).toBeInTheDocument();
    await continueBooking(user);
    await user.type(
      screen.getByLabelText("Appointment notes"),
      "Fictional reception notes",
    );
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));
    expect(stored().appointments).toHaveLength(s.appointments.length);
    const confirm = screen.getByRole("dialog", {
      name: "Confirm appointment booking",
    });
    await user.click(
      within(confirm).getByRole("button", { name: "Save appointment" }),
    );
    const a = stored().appointments.find(
      (a) => a.patientId === "MM-1046" && a.date === DEMO_DATE,
    )!;
    expect(a.notes).toBe("Fictional reception notes");
    expect(
      stored().records["Sittings & Sessions"].find(
        (r) => r.appointmentId === a.id,
      )?.patientId,
    ).toBe("MM-1046");
  });
  it("shows conflicts with resource details and selectable alternatives rather than overriding", async () => {
    const user = userEvent.setup();
    saveState(resetState());
    render(
      <ClinicProvider>
        <AppointmentForm initialPatientId="MM-1041" onClose={() => {}} />
      </ClinicProvider>,
    );
    await continueBooking(user);
    fireEvent.change(screen.getByLabelText("Time (IST)"), {
      target: { value: "09:30" },
    });
    expect(
      screen.getByText("Availability needs attention"),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/already has a visit/).length).toBeGreaterThan(
      0,
    );
    await continueBooking(user);
    expect(screen.getByRole("alert")).toHaveTextContent("already has a visit");
    expect(screen.queryByRole("button", { name: "Confirm booking" })).not.toBeInTheDocument();
    expect(stored().appointments).toHaveLength(7);
  });
  it("switches calendar views, navigates periods and filters by patient/status before opening a detail drawer", async () => {
    const user = userEvent.setup();
    mount(resetState());
    await user.click(screen.getByRole("button", { name: "Week" }));
    expect(screen.getByRole("button", { name: "Week" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Month" }));
    await user.click(screen.getByRole("button", { name: "Open 2026-10-23" }));
    expect(screen.getByRole("button", { name: "Day" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.type(screen.getByLabelText("Search appointments"), "Rohan");
    await user.selectOptions(
      screen.getByLabelText("Filter Status"),
      "In progress",
    );
    expect(
      screen.queryByRole("button", { name: /Priya Patel Acne/ }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getAllByRole("button", { name: /10:00 Rohan Mehta/ })[0],
    );
    const d = screen.getByRole("dialog", { name: "Appointment details" });
    expect(within(d).getByText("PRP hair restoration")).toBeInTheDocument();
    expect(within(d).getByText("Room 02")).toBeInTheDocument();
    await user.click(
      within(d).getByRole("button", { name: "Open session workspace" }),
    );
    expect(
      screen.getByRole("heading", { name: "Existing session workspace" }),
    ).toBeInTheDocument();
  });
  it("edits and reschedules through the drawer while preserving the original appointment ID", async () => {
    const user = userEvent.setup(),
      s = resetState();
    mount(s, "/appointments?appointment=APT-206");
    await user.click(screen.getByRole("button", { name: "Edit / reschedule" }));
    const form = screen.getByRole("dialog", { name: "Edit appointment" });
    expect(within(form).getByLabelText("Patient")).toBeDisabled();
    await user.click(within(form).getByRole("button", { name: "Continue" }));
    fireEvent.change(within(form).getByLabelText("Appointment date"), {
      target: { value: "2026-10-24" },
    });
    fireEvent.change(within(form).getByLabelText("Time (IST)"), {
      target: { value: "16:00" },
    });
    await user.click(within(form).getByRole("button", { name: "Continue" }));
    await user.type(
      within(form).getByLabelText("Booking reason"),
      "Patient requested tomorrow",
    );
    await user.click(
      within(form).getByRole("button", { name: "Review changes" }),
    );
    await user.click(
      within(
        screen.getByRole("dialog", { name: "Confirm appointment changes" }),
      ).getByRole("button", { name: "Save appointment" }),
    );
    expect(stored().appointments.find((a) => a.id === "APT-206")?.date).toBe(
      "2026-10-24",
    );
    expect(stored().sessionCompletions).toHaveLength(0);
    expect(
      stored().records["Sittings & Sessions"].find(
        (r) => r.appointmentId === "APT-206",
      )?.date,
    ).toBe("2026-10-24");
  });
});
describe("follow-up centre interactions", () => {
  it("keeps a private editable WhatsApp draft and records the actual contact outcome", async () => {
    const user = userEvent.setup(),
      s = resetState(),
      r = s.records["Follow-ups"].find((r) => r.dueDate === DEMO_DATE)!;
    mount(s, "/follow-ups");
    await user.click(
      screen.getByRole("button", { name: "Open follow-up " + r.id }),
    );
    await user.click(
      screen.getByRole("button", { name: "Draft WhatsApp Reminder" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Draft WhatsApp Reminder",
    });
    expect(within(dialog).getByLabelText("Reminder draft")).not.toHaveValue(
      expect.stringContaining(r.patientId!),
    );
    await user.clear(within(dialog).getByLabelText("Reminder draft"));
    await user.type(
      within(dialog).getByLabelText("Reminder draft"),
      "Hello, please contact reception to arrange your next visit.",
    );
    await user.type(
      within(dialog).getByLabelText("Contact note"),
      "Patient requested a draft reminder; no message sent",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Save outcome" }),
    );
    expect(
      stored().records["Follow-ups"].find((f) => f.id === r.id)?.followup
        ?.contacts[0].note,
    ).toContain("no delivery claimed");
    await user.click(screen.getByRole("button", { name: "Mark Contacted" }));
    const contact = screen.getByRole("dialog", { name: "Mark Contacted" });
    await user.type(
      within(contact).getByLabelText("Contact note"),
      "Spoke with the patient; visit date requested",
    );
    await user.click(
      within(contact).getByRole("button", { name: "Save outcome" }),
    );
    expect(
      stored().records["Follow-ups"].find((f) => f.id === r.id)?.followup
        ?.contacts,
    ).toHaveLength(2);
  });
  it("requires confirmation for resolution and updates the open/resolved lists", async () => {
    const user = userEvent.setup(),
      s = resetState(),
      r = s.records["Follow-ups"].find((r) => r.dueDate === DEMO_DATE)!;
    mount(s, "/follow-ups");
    await user.click(
      screen.getByRole("button", { name: "Open follow-up " + r.id }),
    );
    await user.click(screen.getByRole("button", { name: "Mark Resolved" }));
    const dialog = screen.getByRole("dialog", { name: "Mark Resolved" });
    await user.click(
      within(dialog).getByRole("button", { name: "Save outcome" }),
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Confirm");
    await user.type(
      within(dialog).getByLabelText("Contact note"),
      "Follow-up completed as documented",
    );
    await user.click(within(dialog).getByLabelText(/Confirm this outcome/));
    await user.click(
      within(dialog).getByRole("button", { name: "Save outcome" }),
    );
    expect(
      stored().records["Follow-ups"].find((f) => f.id === r.id)?.status,
    ).toBe("Completed");
    await user.click(
      within(
        screen.getByRole("dialog", { name: "Follow-up workspace" }),
      ).getByRole("button", { name: "Close" }),
    );
    expect(
      screen.queryByRole("button", { name: "Open follow-up " + r.id }),
    ).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText("Follow-up outcome filter"),
      "Resolved",
    );
    expect(
      screen.getByRole("button", { name: "Open follow-up " + r.id }),
    ).toBeInTheDocument();
  });
  it("opens the same next appointment from a follow-up and pauses drafts for clinical review", async () => {
    const user = userEvent.setup(),
      s = resetState(),
      r = s.records["Follow-ups"].find((r) => r.patientId === "MM-1043")!;
    r.appointmentId = "APT-203";
    r.followupKind = "Adverse reaction review";
    mount(s, "/follow-ups?tab=Reaction+Requiring+Review");
    await user.click(
      screen.getByRole("button", { name: "Open follow-up " + r.id }),
    );
    expect(
      screen.getByRole("button", { name: "Draft WhatsApp Reminder" }),
    ).toBeDisabled();
    expect(
      screen.getAllByText("Routine reminders paused").length,
    ).toBeGreaterThan(0);
    await user.click(
      screen.getByRole("button", { name: /Open appointment ·/ }),
    );
    const d = screen.getByRole("dialog", { name: "Appointment details" });
    expect(within(d).getByText("MM-1043")).toBeInTheDocument();
    expect(within(d).getByText("Acne management")).toBeInTheDocument();
    await user.click(within(d).getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Mark Resolved" }));
    const review = screen.getByRole("dialog", { name: "Mark Resolved" });
    await user.selectOptions(
      within(review).getByLabelText("Follow-up employee"),
      "Dr. Mehta",
    );
    await user.type(
      within(review).getByLabelText("Contact note"),
      "Selected clinician reviewed the fictional reaction record",
    );
    await user.click(within(review).getByLabelText(/Confirm this outcome/));
    await user.click(
      within(review).getByRole("button", { name: "Save outcome" }),
    );
    expect(
      stored().records["Follow-ups"].find((f) => f.id === r.id)?.followup
        ?.contacts[0].employee,
    ).toBe("Dr. Mehta");
  });
});
