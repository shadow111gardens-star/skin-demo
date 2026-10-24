import { beforeEach, describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { type ClinicState, resetState, saveState } from "./data";
const stored = () =>
  JSON.parse(localStorage.getItem("mmverse-v1")!) as ClinicState;
async function enter() {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Enter Demo" }));
  await screen.findByRole("heading", { name: "Good morning, Dr. Mehta." });
  return user;
}
describe("MMVerse demo workflows", () => {
  beforeEach(() => window.history.replaceState({}, "", "/login"));
  it("opens login before Dashboard at the app entry even with a saved demo session, retaining clinic data and role", async () => {
    const user = userEvent.setup();
    const state = resetState();
    state.clinicName = "Saved fictional clinic";
    saveState(state);
    localStorage.setItem("mmverse-session", JSON.stringify({role: "Doctor", email: "demo@example.test", name: "Dr. Mehta"}));
    localStorage.setItem("mmverse-role", "Doctor");
    window.history.replaceState({}, "", "/");
    render(<App />);
    expect(await screen.findByRole("heading", {name: "A better day starts here."})).toBeInTheDocument();
    expect(screen.queryByRole("heading", {name: "Good morning, Dr. Mehta."})).not.toBeInTheDocument();
    expect(screen.getByLabelText("Explore as")).toHaveValue("Doctor");
    await user.click(screen.getByRole("button", {name: "Enter Demo"}));
    expect(await screen.findByRole("heading", {name: "Good morning, Dr. Mehta."})).toBeInTheDocument();
    expect(window.location.pathname).toBe("/dashboard");
    expect(stored().clinicName).toBe("Saved fictional clinic");
    expect(stored().patients.map(p => p.id)).toEqual(state.patients.map(p => p.id));
  });
  it("validates simulated sign-in and toggles password visibility", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Simulate sign in" }));
    expect(screen.getByRole("alert")).toHaveTextContent("valid email");
    await user.type(screen.getByLabelText("Work email"), "mehta@example.test");
    await user.type(screen.getByLabelText("Password"), "demo123");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    await user.selectOptions(screen.getByLabelText("Explore as"), "Doctor");
    await user.click(screen.getByRole("button", { name: "Simulate sign in" }));
    expect(
      await screen.findByRole("heading", { name: "Good morning, Dr. Mehta." }),
    ).toBeInTheDocument();
    expect(localStorage.getItem("mmverse-session")).not.toContain("demo123");
    expect(localStorage.getItem("mmverse-role")).toBe("Doctor");
  }, 60000);
  it("navigates KPI presets and changes dates using shared data", async () => {
    const user = await enter();
    await user.click(
      screen.getByRole("button", { name: /^Checked-in patients/ }),
    );
    expect(window.location.search).toContain("status=Checked+in");
    await screen.findByRole("heading", { name: "Appointments" });
    expect(screen.getByRole("combobox", { name: "Filter Status" })).toHaveValue(
      "Checked in",
    );
    expect(
      screen.getAllByRole("button", { name: /Priya Patel Acne/ })[0],
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Ananya Sharma Laser/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Dashboard" }));
    fireEvent.change(screen.getByLabelText("Dashboard date"), {
      target: { value: "2026-10-24" },
    });
    expect(
      screen.getByRole("button", { name: /^Appointments today 1/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Collections today ₹0/ }),
    ).toBeInTheDocument();
  });
  it("checks in, starts a consent-reviewed session and reschedules a visit", async () => {
    const user = await enter();
    await user.click(
      screen.getByRole("button", { name: "Actions for Arjun Kapoor at 11:30" }),
    );
    await user.click(screen.getByRole("button", { name: "Check in patient" }));
    expect(stored().appointments.find((a) => a.id === "APT-204")?.status).toBe(
      "Checked in",
    );
    await user.click(
      screen.getByRole("button", { name: "Actions for Arjun Kapoor at 11:30" }),
    );
    await user.click(screen.getByRole("button", { name: "Start session" }));
    expect(
      await screen.findByLabelText("Session treatment area"),
    ).toBeInTheDocument();
    expect(stored().appointments.find((a) => a.id === "APT-204")?.status).toBe(
      "Checked in",
    );
    await user.click(screen.getAllByRole("link", { name: "Dashboard" })[0]);
    await screen.findByRole("button", {
      name: "Actions for Ananya Sharma at 15:30",
    });
    await user.click(
      screen.getByRole("button", {
        name: "Actions for Ananya Sharma at 15:30",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Reschedule" }));
    fireEvent.change(screen.getByLabelText("New date"), {
      target: { value: "2026-10-24" },
    });
    fireEvent.change(screen.getByLabelText("New time (IST)"), {
      target: { value: "14:00" },
    });
    await user.click(
      screen.getByRole("button", { name: "Confirm reschedule" }),
    );
    expect(stored().appointments.find((a) => a.id === "APT-206")?.date).toBe(
      "2026-10-24",
    );
    expect(
      screen.queryByRole("button", {
        name: "Actions for Ananya Sharma at 15:30",
      }),
    ).not.toBeInTheDocument();
  });
  it("records a full invoice payment and reconciles Dashboard totals", async () => {
    const user = await enter();
    await user.click(screen.getByRole("button", { name: "Quick create" }));
    await user.click(
      screen.getByRole("button", {
        name: /Record payment Add a simulated collection/,
      }),
    );
    await user.selectOptions(screen.getByLabelText("Patient"), "MM-1042");
    await user.selectOptions(
      screen.getByLabelText("Invoice"),
      "packages-billing-2",
    );
    expect(screen.getByLabelText("Invoice amount")).toHaveValue("24000");
    await user.click(
      screen.getByLabelText(
        "I understand this records a simulated payment only",
      ),
    );
    await user.click(screen.getByRole("button", { name: "Save demo payment" }));
    expect(
      screen.getByRole("button", { name: /^Outstanding payments ₹0/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Collections today ₹66,000/ }),
    ).toBeInTheDocument();
  });
  it("adapts navigation and quick create to a persisted demo role", async () => {
    const user = await enter();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Demo role" }),
      "Laser Technician",
    );
    expect(
      screen.getByRole("heading", { name: "Good morning, Aarav Singh." }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Payments" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Machines & Equipment" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quick create" }));
    expect(
      screen.queryByRole("button", { name: /Record payment Add/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /New session Prepare/ }),
    ).toBeInTheDocument();
    expect(localStorage.getItem("mmverse-role")).toBe("Laser Technician");
  });
  it("registers a patient through quick create and opens it from global search", async () => {
    const user = await enter();
    await user.click(screen.getByRole("button", { name: "Quick create" }));
    await user.click(screen.getByRole("button", { name: /New patient Start/ }));
    await user.type(screen.getByLabelText("Full name"), "Sneha Demo");
    fireEvent.change(screen.getByLabelText("Date of birth"), {
      target: { value: "1994-02-01" },
    });
    await user.type(screen.getByLabelText("Mobile"), "9123456789");
    await user.click(screen.getByRole("button", { name: "Register patient" }));
    await screen.findByRole("heading", { name: "Sneha Demo" });
    await user.click(screen.getByRole("link", { name: "Dashboard" }));
    await screen.findByRole("heading", { name: "Good morning, Dr. Mehta." });
    const global = screen.getByRole("textbox", { name: "Search workspace" });
    await user.type(global, "Sneha Demo");
    await user.click(screen.getByRole("button", { name: /Sneha Demo MM-/ }));
    expect(
      await screen.findByRole("heading", { name: "Sneha Demo" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toContain("/patients/MM-");
  }, 60000);
});
import { modules } from "./data";
it("renders every existing module route through the shared shell", async () => {
  const user = await enter();
  for (const module of modules.filter((m) => m !== "Dashboard")) {
    await user.click(screen.getByRole("link", { name: module }));
    expect(
      await screen.findByRole("heading", {
        name: new RegExp("^" + module + "$", "i"),
      }),
    ).toBeInTheDocument();
  }
}, 60000);
it("opens a notification destination and signs out of the simulated session", async () => {
  const user = await enter();
  await user.click(screen.getByRole("button", { name: "Notifications" }));
  await user.click(
    screen.getByRole("button", {
      name: /PRP collection kits below reorder level/,
    }),
  );
  expect(
    await screen.findByRole("heading", { name: "Inventory" }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Profile menu" }));
  await user.click(
    screen.getByRole("button", { name: "Exit demo / sign out" }),
  );
  expect(
    await screen.findByRole("heading", { name: "A better day starts here." }),
  ).toBeInTheDocument();
  expect(localStorage.getItem("mmverse-session")).toBeNull();
  expect(sessionStorage.getItem("mmverse-session")).toBeNull();
  expect(window.location.pathname).toBe("/login");
});
