import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ClinicProvider } from "../../store";
import { readState } from "../../data";
import InvoiceForm from "./InvoiceForm";
import InvoiceDetail from "./InvoiceDetail";
import PaymentForm from "./PaymentForm";
import Billing from "./Billing";
import Packages from "./Packages";
function mount(ui: React.ReactNode, path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ClinicProvider>
        <Routes>
          <Route path="/" element={ui} />
          <Route path="/invoices/new" element={ui} />
          <Route path="/invoices/:invoiceId" element={<InvoiceDetail />} />
        </Routes>
      </ClinicProvider>
    </MemoryRouter>,
  );
}
beforeEach(() => localStorage.clear());
describe("finance workspace UI", () => {
  it("saves a draft, issues explicitly and opens the connected print-friendly invoice", async () => {
    const user = userEvent.setup();
    mount(<InvoiceForm />, "/invoices/new");
    await user.selectOptions(
      screen.getByLabelText("Invoice patient"),
      "MM-1046",
    );
    fireEvent.change(screen.getByLabelText("Line price 1"), {
      target: { value: "2000" },
    });
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByRole("heading", { name: "DRAFT / NOT ISSUED" });
    expect(readState().records["Packages & Billing"][0].invoice?.state).toBe(
      "Draft",
    );
    await user.click(screen.getByRole("button", { name: "Issue invoice" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm issue" }),
    );
    expect(readState().records["Packages & Billing"][0].invoice?.state).toBe(
      "Issued",
    );
    expect(
      screen.getByRole("button", { name: "Record payment" }),
    ).toBeInTheDocument();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    await user.click(screen.getByRole("button", { name: "Print invoice" }));
    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
  });
  it("prefills invoice balance, records a partial receipt and displays validation inline for a duplicate reference", async () => {
    const user = userEvent.setup(),
      close = vi.fn();
    const view = mount(
      <PaymentForm invoiceId="packages-billing-2" onClose={close} />,
    );
    expect(screen.getByLabelText("Invoice amount")).toHaveValue("24000");
    fireEvent.change(screen.getByLabelText("Amount (INR)"), {
      target: { value: "5000" },
    });
    await user.type(
      screen.getByLabelText("Transaction reference"),
      "DEMO-PARTIAL",
    );
    await user.click(
      screen.getByLabelText(
        "I understand this records a simulated payment only",
      ),
    );
    await user.click(screen.getByRole("button", { name: "Save demo payment" }));
    expect(close).toHaveBeenCalledOnce();
    expect(
      readState().records["Packages & Billing"].find(
        (i) => i.id === "packages-billing-2",
      )?.amount,
    ).toBe(19000);
    view.unmount();
    mount(<PaymentForm invoiceId="packages-billing-2" onClose={close} />);
    fireEvent.change(screen.getByLabelText("Amount (INR)"), {
      target: { value: "5000" },
    });
    await user.type(
      screen.getByLabelText("Transaction reference"),
      "DEMO-PARTIAL",
    );
    await user.click(
      screen.getByLabelText(
        "I understand this records a simulated payment only",
      ),
    );
    await user.click(screen.getByRole("button", { name: "Save demo payment" }));
    expect(screen.getByRole("alert")).toHaveTextContent("duplicate");
  });
  it("updates finance totals and invoice rows from date/status filters", async () => {
    const user = userEvent.setup();
    mount(<Billing />);
    expect(
      screen.getAllByText("₹42,000", { selector: "strong" }).length,
    ).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Finance to date"), {
      target: { value: "2026-10-22" },
    });
    expect(screen.queryByText("INV-2026-0841")).not.toBeInTheDocument();
    expect(
      screen.getByText("No invoices match the selected filters."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await user.selectOptions(
      screen.getByLabelText("Finance invoice status"),
      "Draft",
    );
    expect(screen.getByText("DRAFT-MMV-2026-001")).toBeInTheDocument();
    expect(screen.queryByText("INV-2026-0841")).not.toBeInTheDocument();
  });
  it("edits a package catalogue offer and shows the existing course balance separately", async () => {
    const user = userEvent.setup();
    mount(<Packages />);
    await user.type(screen.getByLabelText("Search packages"), "Laser Hair");
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(
      within(dialog).getByLabelText("Package discount (INR) *"),
      { target: { value: "500" } },
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    expect(
      readState().records["Package Catalogue"].find((r) =>
        r.name.includes("Laser Hair"),
      )?.packageConfig?.discount,
    ).toBe(500);
    await user.click(
      screen.getByRole("button", { name: "Patient package balances" }),
    );
    expect(screen.getByText("Purchased")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open course" }),
    ).toBeInTheDocument();
  });
});
