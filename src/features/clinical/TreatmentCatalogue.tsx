import { useState, type FormEvent } from "react";
import {
  Plus,
  Search,
  ArrowUpRight,
  Clock,
  SlidersHorizontal,
} from "lucide-react";
import { Badge, Modal } from "../../components";
import { money, type RecordItem } from "../../data";
import { canDecide, type TreatmentConfig } from "./model";
import {
  ClinicalNotice,
  DiscardDialog,
  useClinicalSave,
} from "./ClinicalComponents";
import { saveTreatment } from "./services";
import type { Role } from "../../auth";
export default function TreatmentCatalogue({ role }: { role: Role }) {
  const { state } = useClinicalSave();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("Active");
  const [view, setView] = useState<RecordItem | null>(null);
  const [edit, setEdit] = useState<RecordItem | true | null>(null);
  const rows = state.records["Treatment Catalogue"].filter(
    (t) =>
      (t.name + " " + t.treatment?.category)
        .toLowerCase()
        .includes(q.toLowerCase()) &&
      (category === "All" || t.treatment?.category === category) &&
      (status === "All" || t.status === status),
  );
  return (
    <div className="clinical-catalogue">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CONFIGURABLE CARE LIBRARY</div>
          <h1>Treatment Catalogue</h1>
          <p>
            Clear clinic defaults. Considered, individual treatment decisions.
          </p>
        </div>
        {canDecide(role) && (
          <button className="button primary" onClick={() => setEdit(true)}>
            <Plus size={15} />
            New treatment
          </button>
        )}
      </div>
      <ClinicalNotice />
      <div className="clinical-toolbar card">
        <div className="search-field">
          <Search size={15} />
          <input
            aria-label="Search treatments"
            placeholder="Search treatment or category…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <label>
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option>All</option>
            {[
              ...new Set(
                state.records["Treatment Catalogue"].map(
                  (t) => t.treatment?.category,
                ),
              ),
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {["Active", "Inactive", "All"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <button
          className="text-button"
          onClick={() => {
            setQ("");
            setCategory("All");
            setStatus("All");
          }}
        >
          Reset
        </button>
      </div>
      <section className="card clinical-catalogue-list">
        <div className="clinical-catalogue-head">
          <span>Treatment / category</span>
          <span>Clinic defaults</span>
          <span>Individual / package</span>
          <span>Consent & documentation</span>
          <span>Status</span>
        </div>
        {rows.map((t) => (
          <button
            className="clinical-catalogue-row"
            key={t.id}
            onClick={() => setView(t)}
          >
            <span className="clinical-treatment-name">
              <span className="round-symbol sage-bg">
                <SlidersHorizontal size={17} />
              </span>
              <span>
                <strong>{t.name}</strong>
                <small>{t.treatment?.category}</small>
              </span>
            </span>
            <span>
              <strong>
                {t.treatment?.sessions} sessions · {t.treatment?.intervalDays}{" "}
                day interval
              </strong>
              <small>
                <Clock size={10} />
                {t.treatment?.duration} min · {t.treatment?.validityDays} day
                validity
              </small>
            </span>
            <span>
              <strong>
                {money(t.treatment?.individualPrice || 0)} / session
              </strong>
              <small>
                {money(t.treatment?.packagePrice || 0)} /{" "}
                {t.treatment?.sessions} session package
              </small>
            </span>
            <span>
              <strong>{t.treatment?.consent}</strong>
              <small>{t.treatment?.documentation}</small>
            </span>
            <span>
              <Badge>{t.status}</Badge>
              <ArrowUpRight size={13} />
            </span>
          </button>
        ))}
        {!rows.length && (
          <div className="empty">
            <h3>No matching treatments</h3>
            <p>Adjust your search or include inactive treatments.</p>
          </div>
        )}
      </section>
      <p className="clinical-footnote">
        {rows.length} treatments · INR · defaults apply only to new proposals;
        existing quotes are preserved.
      </p>
      {view && (
        <Modal
          title={view.name}
          className="clinical-detail-modal"
          onClose={() => setView(null)}
        >
          <Badge>{view.status}</Badge>
          <p className="clinical-footnote">
            Configurable clinic default. Clinicians confirm suitability,
            interval and treatment parameters.
          </p>
          <dl className="clinical-detail-grid">
            {Object.entries({
              Category: view.treatment?.category,
              Duration: view.treatment?.duration + " minutes",
              "Recommended interval": view.treatment?.intervalDays + " days",
              "Default sessions": view.treatment?.sessions,
              "Individual price": money(view.treatment?.individualPrice || 0),
              "Package price": money(view.treatment?.packagePrice || 0),
              "Package validity": view.treatment?.validityDays + " days",
              "Compatible demo machines":
                view.treatment?.machineIds
                  .map(
                    (id) =>
                      state.records["Machines & Equipment"].find(
                        (m) => m.id === id,
                      )?.name || id,
                  )
                  .join(", ") || "No machine requirement configured",
              "Required documentation": view.treatment?.documentation,
              "Consent requirements": view.treatment?.consent,
            }).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {canDecide(role) && (
            <button
              className="button primary"
              onClick={() => {
                setEdit(view);
                setView(null);
              }}
            >
              Edit defaults
            </button>
          )}
        </Modal>
      )}
      {edit && (
        <TreatmentForm
          existing={edit === true ? undefined : edit}
          onClose={() => setEdit(null)}
        />
      )}
    </div>
  );
}
function TreatmentForm({
  existing,
  onClose,
}: {
  existing?: RecordItem;
  onClose: () => void;
}) {
  const { state, save, error, setError } = useClinicalSave();
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [pending, setPending] = useState<RecordItem | null>(null);
  const c = existing?.treatment;
  function close() {
    if (dirty) setDiscard(true);
    else onClose();
  }
  function persist(r: RecordItem) {
    try {
      if (save(saveTreatment(state, r), "Treatment defaults saved")) onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const treatment: TreatmentConfig = {
      category: String(f.get("category")),
      duration: Number(f.get("duration")),
      intervalDays: Number(f.get("interval")),
      sessions: Number(f.get("sessions")),
      individualPrice: Number(f.get("individual")),
      packagePrice: Number(f.get("package")),
      validityDays: Number(f.get("validity")),
      machineIds: f.getAll("machines").map(String),
      documentation: String(f.get("documentation")),
      consent: String(f.get("consent")),
    };
    const r: RecordItem = {
      ...existing,
      id: existing?.id || "treatment-" + crypto.randomUUID(),
      name: String(f.get("name")),
      amount: treatment.individualPrice,
      status: String(f.get("status")),
      detail: treatment.category + " | " + treatment.duration + " min",
      treatment,
    };
    if (existing?.status === "Active" && r.status === "Inactive") {
      setPending(r);
      return;
    }
    persist(r);
  }
  return (
    <Modal
      title={existing ? "Edit treatment defaults" : "New treatment"}
      className="clinical-form-modal"
      onClose={close}
    >
      <ClinicalNotice />
      <form
        onSubmit={submit}
        onChange={() => setDirty(true)}
        className="clinical-form"
      >
        <div className="clinical-fields">
          <label>
            Treatment name
            <input
              name="name"
              defaultValue={existing?.name}
              required
              maxLength={100}
            />
          </label>
          <label>
            Category
            <input
              name="category"
              defaultValue={c?.category || "Custom"}
              required
            />
          </label>
          {[
            ["Duration (minutes)", "duration", c?.duration || 30],
            ["Recommended interval (days)", "interval", c?.intervalDays || 28],
            ["Default session count", "sessions", c?.sessions || 1],
            [
              "Individual price (INR)",
              "individual",
              c?.individualPrice ?? 2000,
            ],
            ["Package price (INR)", "package", c?.packagePrice ?? 1800],
            ["Validity (days)", "validity", c?.validityDays || 180],
          ].map(([label, name, value]) => (
            <label key={name}>
              {label}
              <input
                name={String(name)}
                type="number"
                min={name === "individual" || name === "package" ? 0 : 1}
                max={name === "sessions" ? 100 : 10000000}
                step="1"
                defaultValue={value}
                required
              />
            </label>
          ))}
          <label>
            Status
            <select name="status" defaultValue={existing?.status || "Active"}>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </label>
        </div>
        <fieldset>
          <legend>Compatible demo machines</legend>
          <p className="clinical-footnote">
            Clinic configuration only. No machine is connected.
          </p>
          {state.records["Machines & Equipment"].map((m) => (
            <label className="checkbox" key={m.id}>
              <input
                type="checkbox"
                name="machines"
                value={m.id}
                defaultChecked={c?.machineIds.includes(m.id)}
              />
              {m.name}
            </label>
          ))}
        </fieldset>
        <label>
          Required documentation
          <textarea
            name="documentation"
            defaultValue={
              c?.documentation ||
              "Clinical assessment; relevant history; treatment record"
            }
            required
          />
        </label>
        <label>
          Consent requirements
          <textarea
            name="consent"
            defaultValue={
              c?.consent ||
              "Treatment-specific consent after clinician discussion"
            }
            required
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="button secondary" onClick={close}>
            Cancel
          </button>
          <button className="button primary">Save treatment</button>
        </div>
      </form>
      {discard && (
        <DiscardDialog onKeep={() => setDiscard(false)} onDiscard={onClose} />
      )}{" "}
      {pending && (
        <Modal
          title="Make this treatment inactive?"
          onClose={() => setPending(null)}
        >
          <p>
            New proposals will no longer offer this treatment. Existing clinical
            records and quotes are retained.
          </p>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => setPending(null)}
            >
              Keep editing
            </button>
            <button
              className="button danger"
              onClick={() => {
                persist(pending);
                setPending(null);
              }}
            >
              Make inactive
            </button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
