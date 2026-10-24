import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Modal } from "../../components";
import { useClinic } from "../../store";
import { resetState } from "../../data";
import { settingSections, type SettingSection } from "./model";
import { sectionOptions } from "./settingsServices";
import SettingsEditor from "./SettingsEditor";
import SchemaSettings from "./SchemaSettings";
import TaxSettings from "./TaxSettings";
export default function ClinicSettings() {
  const { state, setState, notify } = useClinic(),
    [params, setParams] = useSearchParams(),
    [section, setSection] = useState<SettingSection>(
      settingSections.includes(params.get("section") as SettingSection)
        ? (params.get("section") as SettingSection)
        : "Clinic Profile",
    ),
    [selection, setSelection] = useState<Record<string, string>>({}),
    [dirty, setDirty] = useState(false),
    [pending, setPending] = useState<{
      section: SettingSection;
      id?: string;
    }>(),
    [reset, setReset] = useState(false),
    [confirm, setConfirm] = useState(false),
    [epoch, setEpoch] = useState(0);
  const options = sectionOptions(state, section),
    id = selection[section] || options[0]?.value || "";
  const apply = (next: { section: SettingSection; id?: string }) => {
    setSection(next.section);
    if (next.id)
      setSelection((prev) => ({ ...prev, [next.section]: next.id! }));
    setDirty(false);
    setPending(undefined);
    setParams({ section: next.section }, { replace: true });
  };
  const request = (next: { section: SettingSection; id?: string }) =>
    dirty ? setPending(next) : apply(next);
  return (
    <div className="admin-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CLINIC ADMINISTRATION</span>
          <h1>Clinic Settings</h1>
          <p>A connected workspace configured for your clinic.</p>
        </div>
        <span className="admin-environment">
          Local demo · INR · Asia/Kolkata
        </span>
      </div>
      <p className="admin-notice">
        All settings persist in this browser. Clinical defaults are configurable
        clinic settings, not universal protocols. Simulated roles are not a
        production security boundary.
      </p>
      <div className="admin-settings-workspace">
        <aside className="card admin-settings-nav">
          <nav aria-label="Settings sections">
            {settingSections.map((s) => (
              <button
                key={s}
                className={s === section ? "active" : ""}
                aria-current={s === section ? "page" : undefined}
                onClick={() => request({ section: s })}
              >
                {s}
              </button>
            ))}
          </nav>
          <div className="admin-reset-area">
            <strong>Demo data</strong>
            <p>Restore the fictional clinic dataset.</p>
            <button
              className="button"
              onClick={() => {
                setReset(true);
                setConfirm(false);
              }}
            >
              Reset demo records
            </button>
          </div>
        </aside>
        <div className="admin-settings-main">
          <label className="admin-mobile-section">
            Settings section
            <select
              aria-label="Settings section"
              value={section}
              onChange={(e) =>
                request({ section: e.target.value as SettingSection })
              }
            >
              {settingSections.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          {options.length > 0 && (
            <div className="card admin-record-selector">
              <label>
                {section === "Reminder Templates" ||
                section === "Consent Templates"
                  ? "Template"
                  : "Configure record"}
                <select
                  aria-label="Settings record"
                  value={id}
                  onChange={(e) => request({ section, id: e.target.value })}
                >
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                  {id && !options.some((o) => o.value === id) && (
                    <option value={id}>New template draft</option>
                  )}
                </select>
              </label>
              {["Reminder Templates", "Consent Templates"].includes(
                section,
              ) && (
                <button
                  className="button"
                  onClick={() =>
                    request({ section, id: "template-" + crypto.randomUUID() })
                  }
                >
                  + Add template
                </button>
              )}
            </div>
          )}
          {section === "Session Parameter Schemas" ? (
            <SchemaSettings
              key={section + id + epoch}
              id={id}
              onDirty={setDirty}
            />
          ) : section === "Tax Configuration" ? (
            <TaxSettings key={section + epoch} onDirty={setDirty} />
          ) : (
            <SettingsEditor
              key={section + id + epoch}
              section={section}
              id={id}
              onDirty={setDirty}
            />
          )}
          <div className="admin-related-links">
            <Link to="/treatment-catalogue">Treatment catalogue</Link>
            <Link to="/machines-equipment">Equipment directory</Link>
            <Link to="/rooms-resources">Rooms</Link>
            <Link to="/packages">Packages</Link>
          </div>
          <div className="admin-mobile-reset">
            <button
              className="button"
              onClick={() => {
                setReset(true);
                setConfirm(false);
              }}
            >
              Reset demo records
            </button>
          </div>
        </div>
      </div>
      {pending && (
        <Modal
          title="Discard unsaved settings?"
          onClose={() => setPending(undefined)}
        >
          <p>
            Save Changes before leaving to keep this draft, or discard it and
            open the selected settings section.
          </p>
          <div className="modal-actions">
            <button className="button" onClick={() => setPending(undefined)}>
              Keep editing
            </button>
            <button className="button danger" onClick={() => apply(pending)}>
              Discard and continue
            </button>
          </div>
        </Modal>
      )}
      {reset && (
        <Modal
          title="Reset MMVerse local demo data?"
          className="operations-modal"
          onClose={() => setReset(false)}
        >
          <p>
            This replaces MMVerse patients, courses, bookings, inventory,
            finance, staff, settings, integration simulations and notification
            states with a consistent fictional starting dataset.
          </p>
          <p>
            Only the MMVerse clinic record in this browser is replaced.
            Unrelated browser data and files are untouched. Your current demo
            role and session remain available.
          </p>
          <label className="operations-confirm">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
            />
            I understand my MMVerse local demo changes will be replaced.
          </label>
          <div className="modal-actions">
            <button className="button" onClick={() => setReset(false)}>
              Keep my data
            </button>
            <button
              className="button danger"
              disabled={!confirm}
              onClick={() => {
                const fresh = resetState();
                setState(fresh);
                localStorage.setItem("mmverse-v1", JSON.stringify(fresh));
                setSection("Clinic Profile");
                setSelection({});
                setEpoch(epoch + 1);
                setDirty(false);
                setPending(undefined);
                setReset(false);
                setParams({ section: "Clinic Profile" }, { replace: true });
                notify("Fictional MMVerse demo records restored");
              }}
            >
              Reset MMVerse demo data
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
