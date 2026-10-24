import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClinicProvider } from "../store";
import QuickCreate, { type CreateKind } from "./QuickCreate";
import { type ClinicState } from "../data";
const stored = () =>
  JSON.parse(localStorage.getItem("mmverse-v1")!) as ClinicState;
function renderForm(kind: CreateKind) {
  const close = vi.fn();
  render(
    <ClinicProvider>
      <QuickCreate kind={kind} onClose={close} />
    </ClinicProvider>,
  );
  return close;
}
describe("quick-create workflows", () => {
  it("books an appointment and keeps the patient, course and schedule connected", async () => {
    const user = userEvent.setup();
    const close = renderForm("appointment");
    await user.selectOptions(screen.getByLabelText("Patient"), "MM-1046");
    await user.selectOptions(
      screen.getByLabelText("Treatment"),
      "Chemical Peel",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("Time (IST)"), {
      target: { value: "14:30" },
    });
    await user.selectOptions(screen.getByLabelText("Room"), "Room 03");
    await user.selectOptions(screen.getByLabelText("Technician"), "Neha Rao");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));
    await user.click(screen.getByRole("button", { name: "Save appointment" }));
    const visit = stored().appointments.find((a) => a.time === "14:30")!;
    expect(visit.patientId).toBe("MM-1046");
    expect(visit.courseId).toBeUndefined();
    expect(visit.room).toBe("Room 03");
    expect(visit.technician).toBe("Neha Rao");
    expect(close).toHaveBeenCalledOnce();
  });
  it("rejects a booking conflict without mutating the schedule", async () => {
    const user = userEvent.setup();
    renderForm("appointment");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("Time (IST)"), {
      target: { value: "09:30" },
    });
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent("already has a visit");
      expect(screen.queryByRole("button", { name: "Confirm booking" })).not.toBeInTheDocument();
      expect(screen.getByLabelText("Time (IST)")).toHaveValue("09:30");
    expect(stored().appointments).toHaveLength(7);
  });
  it("saves a demonstration scan only after capture consent", async () => {
    const user = userEvent.setup();
    const close = renderForm("scan");
    await user.selectOptions(
      await screen.findByLabelText("Patient"),
      "MM-1041",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(
      screen.getByRole("button", { name: "Simulate device import" }),
    );
    await screen.findByRole("button", {
      name: "Remove mmverse-demonstration-report.pdf",
    });
    await user.click(screen.getByRole("button", { name: /Confirm & save/ }));
    await user.click(
      screen.getByRole("button", { name: "Save & open doctor review" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("consent");
    expect(close).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: /Capture & source files/ }),
    );
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /Confirm & save/ }));
    await user.click(
      screen.getByRole("button", { name: "Save & open doctor review" }),
    );
    const scan = stored().records["Skin Analysis"][0];
    expect(scan.patientId).toBe("MM-1041");
    expect(scan.status).toBe("Awaiting Review");
    expect(scan.scan?.source).toBe("Simulated import");
    expect(close).toHaveBeenCalledOnce();
  });
  it("saves a proposed plan draft without creating an active course", async () => {
    const user = userEvent.setup();
    const close = renderForm("plan");
    await user.selectOptions(screen.getByLabelText("Patient"), "MM-1041");
    await user.click(screen.getByRole("button", { name: "Save Draft" }));
    const plan = stored().records["Plan Proposals"][0];
    expect(plan.status).toBe("Draft");
    expect(plan.patientId).toBe("MM-1041");
    expect(stored().records["Treatment Plans"]).toHaveLength(3);
    expect(close).toHaveBeenCalledOnce();
  });
  it("prepares a session using the date of the linked future appointment", async () => {
    const user = userEvent.setup();
    renderForm("session");
    await user.selectOptions(screen.getByLabelText("Patient"), "MM-1046");
    await user.selectOptions(screen.getByLabelText("Appointment"), "APT-207");
    await user.click(
      screen.getByRole("button", { name: "Open session workspace" }),
    );
    const session = stored().records["Sittings & Sessions"].find(
      (r) => r.appointmentId === "APT-207",
    )!;
    expect(session.patientId).toBe("MM-1046");
    expect(session.appointmentId).toBe("APT-207");
    expect(session.date).toBe("2026-10-24");
    expect(session.status).toBe("Scheduled");
  });
});
