import { useState } from "react";
import { Badge } from "../../components";
import { type RecordItem } from "../../data";
import { useClinic } from "../../store";
import {
  Metrics,
  OperationForm,
  options,
  Empty,
} from "../operations/OperationsUI";
import { roles, roleGuide } from "./access";
import { saveStaff } from "./staffServices";
import type { Role } from "../../auth";
export default function Staff() {
  const { state, setState, notify } = useClinic(),
    [q, setQ] = useState(""),
    [role, setRole] = useState(""),
    [status, setStatus] = useState(""),
    [edit, setEdit] = useState<RecordItem | null | undefined>(),
    [error, setError] = useState("");
  const staff = state.records["Staff & Roles"],
    rows = staff.filter(
      (r) =>
        r.staff &&
        (r.name + " " + r.staff.phone + " " + r.staff.email)
          .toLowerCase()
          .includes(q.toLowerCase()) &&
        (!role || r.staff.role === role) &&
        (!status || r.status === status),
    );
  return (
    <div className="admin-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CLINIC ADMINISTRATION</span>
          <h1>Staff & Roles</h1>
          <p>Keep your demo team, availability and responsibilities in view.</p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setEdit(null);
            setError("");
          }}
        >
          + Add staff member
        </button>
      </div>
      <p className="admin-notice">
        Fictional staff profiles and simulated role views. No production
        authentication or access control is provided.
      </p>
      <Metrics
        items={[
          ["Team profiles", staff.length],
          ["Active", staff.filter((r) => r.status === "Active").length],
          [
            "Available",
            staff.filter(
              (r) =>
                r.status === "Active" && r.staff?.availability === "Available",
            ).length,
          ],
          ["Demo roles", roles.length],
        ]}
      />
      <section className="card">
        <div className="operations-filters">
          <label>
            Search staff
            <input
              aria-label="Search staff"
              placeholder="Name, mobile or email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <label>
            Role
            <select
              aria-label="Staff role filter"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="">All roles</option>
              {roles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              aria-label="Staff status filter"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </label>
          <button
            className="button"
            onClick={() => {
              setQ("");
              setRole("");
              setStatus("");
            }}
          >
            Reset filters
          </button>
        </div>
        {rows.map((r) => (
          <article className="admin-staff-row" key={r.id}>
            <div>
              <strong>{r.name}</strong>
              <small>
                {r.id} · {r.staff?.role}
              </small>
            </div>
            <div>
              {r.staff?.phone}
              <small>{r.staff?.email || "Email not recorded"}</small>
            </div>
            <div>
              <Badge>{r.staff?.availability}</Badge>
              <small>{r.status}</small>
            </div>
            <button
              className="button"
              onClick={() => {
                setEdit(r);
                setError("");
              }}
            >
              Edit staff
            </button>
          </article>
        ))}
        {!rows.length && <Empty>No staff profiles match these filters.</Empty>}
      </section>
      <section className="card admin-permissions">
        <h2>Demo role-permission guide</h2>
        <p>
          View/manage describes the simulated navigation and available workflow
          actions. Clinical approvals stay with Doctor / Clinic Owner;
          technician management covers session documentation. The role switcher
          changes the demo interface, not a security boundary.
        </p>
        <div className="admin-permission-grid">
          {roles.map((r) => (
            <article key={r}>
              <h3>{r}</h3>
              {roleGuide(r).map((p) => (
                <div key={p.group}>
                  <span>{p.group}</span>
                  <strong>
                    {p.manage
                      ? "View + manage"
                      : p.view
                        ? "View"
                        : "Not in demo navigation"}
                  </strong>
                </div>
              ))}
            </article>
          ))}
        </div>
      </section>
      {edit !== undefined && (
        <OperationForm
          title={edit ? "Edit staff member" : "Create staff member"}
          fields={[
            { key: "name", label: "Full name", required: true },
            {
              key: "role",
              label: "Demo role",
              required: true,
              options: options([...roles]),
            },
            { key: "phone", label: "Mobile", type: "tel", required: true },
            { key: "email", label: "Email", type: "email" },
            {
              key: "availability",
              label: "Availability",
              options: options(["Available", "On leave", "Unavailable"]),
            },
            {
              key: "status",
              label: "Staff status",
              options: options(["Active", "Inactive"]),
            },
            { key: "notes", label: "Staff notes", type: "textarea" },
          ]}
          initial={{
            name: edit?.name || "",
            role: edit?.staff?.role || "Receptionist",
            phone: edit?.staff?.phone || "",
            email: edit?.staff?.email || "",
            availability: edit?.staff?.availability || "Available",
            status: edit?.status || "Active",
            notes: edit?.staff?.notes || "",
          }}
          confirmation="I confirm these staff details and availability. New bookings use active available staff; historical clinical signatures are retained."
          onClose={() => setEdit(undefined)}
          onSave={(v) => {
            try {
              setState(
                saveStaff(state, {
                  ...edit,
                  id: edit?.id || "staff-" + crypto.randomUUID(),
                  name: v.name,
                  status: v.status,
                  detail: v.notes,
                  amount: 0,
                  staff: {
                    role: v.role as Role,
                    phone: v.phone,
                    email: v.email,
                    availability: v.availability as
                      "Available" | "On leave" | "Unavailable",
                    notes: v.notes,
                    previousNames: edit?.staff?.previousNames || [],
                  },
                }),
              );
              notify("Demo staff profile saved");
              return true;
            } catch (e) {
              setError(e instanceof Error ? e.message : "Unable to save");
              return false;
            }
          }}
        >
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </OperationForm>
      )}
    </div>
  );
}
