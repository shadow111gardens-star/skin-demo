import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ClinicProvider } from "../../store";
import { readState } from "../../data";
import Reports from "./Reports";
function mount() {
  return render(
    <MemoryRouter>
      <ClinicProvider>
        <Reports />
      </ClinicProvider>
    </MemoryRouter>,
  );
}
beforeEach(() => localStorage.clear());
describe("analytics interactions", () => {
  it("drills into source records from a KPI and chart legend", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(
      screen.getByRole("button", { name: /^Sessions completed / }),
    );
    let d = screen.getByRole("dialog");
    expect(
      within(d).getByText(/Completed sitting records/),
    ).toBeInTheDocument();
    expect(within(d).getAllByRole("link").length).toBeGreaterThan(0);
    await user.click(within(d).getByRole("button", { name: "Close" }));
    await user.click(
      screen.getByRole("button", { name: "View records for Cancellations" }),
    );
    d = screen.getByRole("dialog");
    expect(
      within(d).getByText(/No qualifying source records/),
    ).toBeInTheDocument();
  });
  it("updates date-filtered figures, chart value tables and empty states without inventing data", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(
      screen.getByRole("button", { name: "Financial Performance" }),
    );
    expect(
      screen.getByRole("button", { name: /^Collections received \(net\)/ }),
    ).toHaveTextContent("42,000");
    await user.click(
      screen.getAllByRole("button", { name: "Show chart values" })[0],
    );
    expect(
      screen.getAllByText("Net collections: ₹42,000").length,
    ).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Report from date"), {
      target: { value: "2025-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Report to date"), {
      target: { value: "2025-01-07" },
    });
    expect(
      screen.getByRole("button", { name: /^Collections received \(net\)/ }),
    ).toHaveTextContent("₹0");
    expect(
      screen.getByText("No recorded activity in this range for these series."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No recorded activity in this range."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Net collections: ₹42,000"),
    ).not.toBeInTheDocument();
  });
  it("exports a CSV download for the visible category and preserves comparison controls", async () => {
    const user = userEvent.setup(),
      create = vi.fn((blob: Blob) => "blob:report-test-" + blob.size),
      revoke = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      value: create,
      configurable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: revoke,
      configurable: true,
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    mount();
    await user.click(
      screen.getByRole("button", { name: "Export visible CSV" }),
    );
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(click).toHaveBeenCalledOnce();
    expect(screen.getByText(/Comparison: 2026-10-10/)).toBeInTheDocument();
    await user.click(screen.getByLabelText("Compare previous equal period"));
    expect(screen.queryByText(/Comparison:/)).not.toBeInTheDocument();
    click.mockRestore();
  });
  it("recalculates room planning utilisation after saving configuration and rejects invalid dates", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(
      screen.getByRole("button", { name: "Resource Utilisation" }),
    );
    fireEvent.change(screen.getByLabelText("Room planning minutes per day"), {
      target: { value: "240" },
    });
    await user.click(
      screen.getByRole("button", { name: "Save planning capacity" }),
    );
    expect(readState().analyticsConfiguration?.roomPlanningMinutes).toBe(240);
    fireEvent.change(screen.getByLabelText("Report from date"), {
      target: { value: "2026-10-24" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Choose valid dates");
    expect(
      screen.getByRole("button", { name: "Export visible CSV" }),
    ).toBeDisabled();
  });
});
