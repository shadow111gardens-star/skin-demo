import { beforeEach, describe, it, expect } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ClinicProvider, useClinic } from "../../store";
import { readState } from "../../data";
import Machines from "./Machines";
import Maintenance from "./Maintenance";
import Inventory from "./Inventory";
import Rooms from "./Rooms";
function Toast() {
  const { toast } = useClinic();
  return <div role="status">{toast}</div>;
}
function mount(ui: React.ReactNode) {
  return render(
    <ClinicProvider>
      <MemoryRouter>
        {ui}
        <Toast />
      </MemoryRouter>
    </ClinicProvider>,
  );
}
beforeEach(() => localStorage.clear());
describe("operations workspace actions", () => {
  it("searches and filters machines, confirms status changes and creates a clearance task", async () => {
    const user = userEvent.setup();
    mount(<Machines />);
    expect(screen.getAllByRole("button", { name: "Details" })).toHaveLength(5);
    await user.type(screen.getByLabelText("Search machines"), "Soprano");
    expect(screen.getAllByRole("button", { name: "Details" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Set status" }));
    const dialog = screen.getByRole("dialog");
    await user.selectOptions(
      within(dialog).getByLabelText("Machine status *"),
      "Under Maintenance",
    );
    await user.type(
      within(dialog).getByLabelText("Reason / clearance reference *"),
      "Fictional service required",
    );
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    expect(readState().records["Machines & Equipment"][0].status).toBe(
      "Under Maintenance",
    );
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await user.selectOptions(
      screen.getByLabelText("Status"),
      "Under Maintenance",
    );
    expect(screen.getAllByRole("button", { name: "Details" })).toHaveLength(2);
  });
  it("records stock in/out with a preview and preserves movement history", async () => {
    const user = userEvent.setup();
    mount(<Inventory />);
    await user.type(
      screen.getByLabelText("Search inventory"),
      "Conductive gel",
    );
    await user.click(screen.getByRole("button", { name: "Stock out" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Quantity *"), {
      target: { value: "3" },
    });
    await user.type(
      within(dialog).getByLabelText("Reason / consumable documentation *"),
      "Fictional damaged batch disposal",
    );
    expect(
      within(dialog).getByText(/After adjustment: 25 bottles/),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(
      within(dialog).getByRole("button", { name: "Save adjustment" }),
    );
    expect(readState().records.Inventory[1].inventory!.quantity).toBe(25);
    await user.click(screen.getByRole("button", { name: "History" }));
    expect(
      within(screen.getByRole("dialog")).getByText(
        "Fictional damaged batch disposal",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog")).getByText("Stock out"),
    ).toBeInTheDocument();
  });
  it("completes seeded maintenance with documentation and restores the machine", async () => {
    const user = userEvent.setup();
    mount(<Maintenance />);
    await user.selectOptions(
      screen.getByLabelText("Machine"),
      "machines-equipment-4",
    );
    await user.click(screen.getByRole("button", { name: "Update / clear" }));
    const dialog = screen.getByRole("dialog");
    await user.selectOptions(
      within(dialog).getByLabelText("Task status"),
      "Completed",
    );
    fireEvent.change(
      within(dialog).getByLabelText("Service date (required for completion)"),
      { target: { value: "2026-10-23" } },
    );
    await user.type(
      within(dialog).getByLabelText(
        "Service / clearance notes (required for completion)",
      ),
      "Fictional clearance passed",
    );
    await user.selectOptions(
      within(dialog).getByLabelText("Availability after completion"),
      "yes",
    );
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    expect(
      readState().records["Machines & Equipment"].find(
        (m) => m.id === "machines-equipment-4",
      )?.status,
    ).toBe("Available");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Maintenance record saved",
    );
  });
  it("updates room availability and provides filtered empty states", async () => {
    const user = userEvent.setup();
    mount(<Rooms />);
    await user.type(screen.getByLabelText("Search rooms"), "Assessment");
    await user.click(
      screen.getByRole("button", { name: "Edit room / availability" }),
    );
    const dialog = screen.getByRole("dialog");
    await user.selectOptions(
      within(dialog).getByLabelText("Availability"),
      "Unavailable",
    );
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    expect(readState().records["Rooms & Resources"][3].status).toBe(
      "Unavailable",
    );
    await user.selectOptions(
      screen.getByLabelText("Availability"),
      "Available",
    );
    expect(
      screen.queryByRole("button", { name: "Edit room / availability" }),
    ).not.toBeInTheDocument();
  });
});
