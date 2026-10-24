import { beforeEach, describe, it, expect } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ClinicProvider } from "../../store";
import { readState } from "../../data";
import Leads from "./Leads";
function mount() {
  return render(
    <MemoryRouter>
      <ClinicProvider>
        <Leads />
      </ClinicProvider>
    </MemoryRouter>,
  );
}
beforeEach(() => localStorage.clear());
describe("CRM workspace interactions", () => {
  it("searches normalized mobile numbers, switches list view and combines stage filters", async () => {
    const user = userEvent.setup();
    mount();
    await user.type(screen.getByLabelText("Search enquiries"), "9876543211");
    expect(screen.getByText("Rohan Mehta")).toBeInTheDocument();
    expect(screen.queryByText("Sneha Desai")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "List view" }));
    await user.selectOptions(
      screen.getByLabelText("Lead stage filter"),
      "Lost",
    );
    expect(screen.getByText(/No enquiries match/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("Sneha Desai")).toBeInTheDocument();
  });
  it("logs contact, moves stage with confirmation and retains the audit in the drawer", async () => {
    const user = userEvent.setup();
    mount();
    await user.type(screen.getByLabelText("Search enquiries"), "Sneha");
    await user.click(screen.getByText("Sneha Desai").closest("button")!);
    await user.click(screen.getByRole("button", { name: "Log contact" }));
    let d = screen.getByRole("dialog", { name: "Log lead contact" });
    await user.type(
      within(d).getByLabelText("Contact note *"),
      "Fictional callback requested",
    );
    await user.click(within(d).getByRole("button", { name: "Save changes" }));
    expect(
      readState().records["Leads & Enquiries"].find(
        (r) => r.name === "Sneha Desai",
      )?.status,
    ).toBe("Contacted");
    expect(
      screen.getAllByText("Fictional callback requested", { selector: "p" }),
    ).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Move stage" }));
    d = screen.getByRole("dialog", { name: "Move enquiry stage" });
    await user.selectOptions(within(d).getByLabelText("New stage *"), "Lost");
    await user.type(
      within(d).getByLabelText("Stage-change reason *"),
      "Fictional enquiry withdrawn",
    );
    await user.click(within(d).getByRole("checkbox"));
    await user.click(within(d).getByRole("button", { name: "Save changes" }));
    expect(
      readState().records["Leads & Enquiries"].find(
        (r) => r.name === "Sneha Desai",
      )?.status,
    ).toBe("Lost");
    expect(
      screen.queryByRole("button", { name: "Log contact" }),
    ).not.toBeInTheDocument();
  });
  it("offers matching-patient reuse and does not register a duplicate contact", async () => {
    const user = userEvent.setup();
    mount();
    await user.type(screen.getByLabelText("Search enquiries"), "Rohan");
    await user.click(screen.getByText("Rohan Mehta").closest("button")!);
    await user.click(
      screen.getByRole("button", { name: "Convert to patient" }),
    );
    const d = screen.getByRole("dialog", {
      name: "Convert enquiry to patient",
    });
    expect(within(d).getByText("Likely existing patients")).toBeInTheDocument();
    expect(
      within(d).getByRole("button", { name: "Register & link patient" }),
    ).toBeDisabled();
    await user.click(within(d).getByRole("checkbox"));
    await user.click(within(d).getByRole("button", { name: "Reuse MM-1042" }));
    expect(readState().patients).toHaveLength(6);
    expect(
      readState().records["Leads & Enquiries"].find(
        (r) => r.id === "crm-lead-returning",
      )?.patientId,
    ).toBe("MM-1042");
  });
  it("registers from prefilled lead data and persists the linked patient", async () => {
    const user = userEvent.setup();
    mount();
    await user.type(screen.getByLabelText("Search enquiries"), "Sneha");
    await user.click(screen.getByText("Sneha Desai").closest("button")!);
    await user.click(
      screen.getByRole("button", { name: "Convert to patient" }),
    );
    const d = screen.getByRole("dialog", {
      name: "Convert enquiry to patient",
    });
    expect(within(d).getByLabelText("Conversion full name")).toHaveValue(
      "Sneha Desai",
    );
    fireEvent.change(within(d).getByLabelText("Conversion date of birth"), {
      target: { value: "1995-01-01" },
    });
    await user.click(within(d).getByRole("checkbox"));
    await user.click(
      within(d).getByRole("button", { name: "Register & link patient" }),
    );
    const s = readState(),
      lead = s.records["Leads & Enquiries"].find(
        (r) => r.name === "Sneha Desai",
      )!;
    expect(s.patients).toHaveLength(7);
    expect(s.patients.find((p) => p.id === lead.patientId)?.phone).toBe(
      lead.lead?.phone,
    );
    expect(lead.status).toBe("Contacted");
  });
});
