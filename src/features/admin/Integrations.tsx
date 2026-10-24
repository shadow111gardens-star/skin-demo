import { useState } from "react";
import { Link } from "react-router-dom";
import { Modal, Badge } from "../../components";
import { useClinic } from "../../store";
import { defaultAdminSettings } from "./model";
const integrations = [
  {
    id: "skin-devices",
    name: "Skin analysis devices",
    status: "Demo Simulation",
    description:
      "Organise fictional scan files and simulate an import response. No device is discovered, paired or synced.",
    action: "Simulate device test",
  },
  {
    id: "whatsapp",
    name: "WhatsApp reminder drafts",
    status: "Demo Simulation",
    description:
      "Preview an editable reminder template. No WhatsApp account, API connection or message delivery is involved.",
    action: "Preview demo reminder",
  },
  {
    id: "billing",
    name: "Payment / billing connectivity",
    status: "Future Integration",
    description:
      "A possible future gateway integration. The current finance workflow records simulated ledger entries only.",
    action: "View integration notes",
  },
  {
    id: "calendar",
    name: "External calendar",
    status: "Not Connected",
    description:
      "Appointments use the local demo store. No Google, Microsoft or external calendar is connected or synced.",
    action: "Show connection status",
  },
];
export default function Integrations() {
  const { state, setState, notify } = useClinic(),
    [selected, setSelected] = useState(""),
    [result, setResult] = useState(""),
    [busy, setBusy] = useState("");
  const a = state.adminSettings || defaultAdminSettings();
  async function simulate(id: string) {
    setBusy(id);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const message =
      id === "skin-devices"
        ? "Simulated test complete. No real device was connected or imported. Use Skin Analysis to import fictional demo files."
        : id === "whatsapp"
          ? (
              a.reminderTemplates.find((t) => t.id === a.defaultReminderId)
                ?.body || ""
            )
              .replaceAll("{firstName}", "Demo")
              .replaceAll("{clinicName}", state.clinicName)
              .replaceAll("{datePhrase}", " around 2026-10-24")
              .replaceAll("{date}", "2026-10-24")
          : id === "billing"
            ? "Future integration concept only. No gateway, payment processing, credentials or real charge exists in this frontend demo."
            : "Not Connected. No external calendar account is configured; local appointments are the source of truth.";
    setResult(message);
    setSelected(id);
    setBusy("");
    setState((s) => ({
      ...s,
      adminSettings: {
        ...(s.adminSettings || defaultAdminSettings()),
        integrationEvents: [
          {
            id: crypto.randomUUID(),
            integration: id,
            at: new Date().toISOString(),
            message:
              "Demo-only response shown; no external connection or delivery.",
          },
          ...(s.adminSettings?.integrationEvents || []),
        ].slice(0, 100),
      },
    }));
    notify(
      id === "whatsapp"
        ? "Demo reminder preview prepared; not sent"
        : "Demo integration information shown",
    );
  }
  return (
    <div className="admin-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CLINIC ADMINISTRATION</span>
          <h1>Integrations</h1>
          <p>
            Clear connection states, without pretending the demo is connected.
          </p>
        </div>
      </div>
      <p className="admin-notice">
        This frontend makes no device, messaging, gateway or external calendar
        connection. Test actions only show simulated responses or local
        configuration information.
      </p>
      <div className="admin-integration-grid">
        {integrations.map((i) => (
          <section className="card admin-integration" key={i.id}>
            <Badge>{i.status}</Badge>
            <h2>{i.name}</h2>
            <p>{i.description}</p>
            <button
              className="button"
              disabled={!!busy}
              onClick={() => void simulate(i.id)}
            >
              {busy === i.id ? "Preparing demo response…" : i.action}
            </button>
            {a.integrationEvents.find((e) => e.integration === i.id) && (
              <small>
                Last local demo action:{" "}
                {new Date(
                  a.integrationEvents.find((e) => e.integration === i.id)!.at,
                ).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}{" "}
                IST
              </small>
            )}
          </section>
        ))}
      </div>
      {selected && (
        <Modal
          title={
            integrations.find((i) => i.id === selected)?.name +
            " · Demo response"
          }
          className="operations-modal"
          onClose={() => setSelected("")}
        >
          <Badge>{integrations.find((i) => i.id === selected)?.status}</Badge>
          <div className="admin-preview">
            <p>{result}</p>
          </div>
          <p className="admin-note">
            Simulation / local preview only. Nothing was connected, sent, synced
            or processed externally.
          </p>
          {selected === "skin-devices" && (
            <Link className="button primary" to="/skin-analysis/new">
              Open fictional scan import
            </Link>
          )}
          {selected === "whatsapp" && (
            <Link
              className="button"
              to="/clinic-settings?section=Reminder%20Templates"
            >
              Edit local reminder templates
            </Link>
          )}
          <button className="button" onClick={() => setSelected("")}>
            Close response
          </button>
        </Modal>
      )}
    </div>
  );
}
