import { describe, it, expect } from "vitest";
import { resetState } from "./data";
import {
  calculateAge,
  filterPatients,
  likelyDuplicates,
  patientSummary,
  updatePatient,
  validEmail,
  validPhone,
  type PatientFilters,
} from "./patientServices";
const filters: PatientFilters = {
  q: "",
  status: "All",
  treatment: "All",
  doctor: "All",
  next: "All",
  sort: "Name: A–Z",
};
describe("patient business rules", () => {
  it("calculates age at the clinic date and rejects impossible or future birth dates", () => {
    expect(calculateAge("1997-10-24")).toBe(28);
    expect(calculateAge("1997-10-23")).toBe(29);
    expect(calculateAge("2026-10-24")).toBeNull();
    expect(calculateAge("2000-02-31")).toBeNull();
    expect(validPhone("+91 98765 43210")).toBe(true);
    expect(validPhone("1234")).toBe(false);
    expect(validEmail("not-an-email")).toBe(false);
  });
  it("finds duplicate identities by normalized mobile or email and excludes the edited record", () => {
    const s = resetState();
    expect(likelyDuplicates(s.patients, "+91 98765 43210", "")[0].id).toBe(
      "MM-1041",
    );
    expect(
      likelyDuplicates(s.patients, "", "ANANYA.SHARMA@EXAMPLE.TEST")[0].id,
    ).toBe("MM-1041");
    expect(
      likelyDuplicates(
        s.patients,
        s.patients[0].phone,
        s.patients[0].email!,
        "MM-1041",
      ),
    ).toHaveLength(0);
  });
  it("combines filters and derives upcoming visits, active courses and balances from shared records", () => {
    const s = resetState();
    const rows = filterPatients(s, {
      ...filters,
      status: "Active",
      treatment: "PRP hair restoration",
      doctor: "Dr. Neha Kapoor",
      next: "Today",
    });
    expect(rows.map((p) => p.id)).toEqual(["MM-1042"]);
    const meta = patientSummary(s, rows[0]);
    expect(meta.outstanding).toBe(24000);
    expect(meta.active).toHaveLength(1);
    expect(meta.next?.id).toBe("APT-202");
    expect(
      filterPatients(s, { ...filters, q: "+91 98765 43211" }).map((p) => p.id),
    ).toEqual(["MM-1042"]);
    expect(
      filterPatients(s, { ...filters, sort: "Balance: high to low" })[0].id,
    ).toBe("MM-1042");
  });
  it("renames a patient without changing IDs or disconnecting clinical and payment records", () => {
    const s = resetState();
    const updated = updatePatient(s, { ...s.patients[0], name: "Ananya Demo" });
    expect(updated.patients[0].id).toBe("MM-1041");
    expect(updated.appointments).toEqual(s.appointments);
    expect(
      updated.records["Payments"].find((r) => r.patientId === "MM-1041")?.name,
    ).toBe("Ananya Demo");
    expect(updated.records["Packages & Billing"][0].name).toContain(
      "Ananya Demo",
    );
    expect(updated.patients).toHaveLength(s.patients.length);
  });
});
it("clears the derived overdue patient state when the linked follow-up is completed", () => {
  const s = resetState();
  const arjun = s.patients.find((p) => p.id === "MM-1044")!;
  expect(patientSummary(s, arjun).status).toBe("Overdue");
  s.records["Follow-ups"] = s.records["Follow-ups"].map((r) =>
    r.patientId === arjun.id ? { ...r, status: "Completed" } : r,
  );
  expect(patientSummary(s, arjun).status).toBe("Active");
  expect(
    filterPatients(s, { ...filters, status: "Overdue" }).map((p) => p.id),
  ).toEqual(["MM-1045"]);
});
