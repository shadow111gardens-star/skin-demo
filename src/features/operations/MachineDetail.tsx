import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Modal } from "../../components";
import { DEMO_DATE } from "../../data";
import {
  OperationHeader,
  Metrics,
  DetailList,
  Empty,
  useOperation,
  actor,
} from "./OperationsUI";
import {
  compatibleTreatments,
  machineStatus,
  machineUsage,
  roomFor,
} from "./selectors";
import { MachineEditor, MachineStatusForm } from "./Machines";
import { MaintenanceEditor } from "./Maintenance";
import { saveMachine } from "./services";
import { readAsset, validateUpload } from "../scans/assets";
import { AssetViewer } from "../scans/ScanComponents";
import type { ScanAsset } from "../scans/model";
export default function MachineDetail() {
  const { machineId } = useParams(),
    { state, commit } = useOperation(),
    [tab, setTab] = useState("Overview"),
    [edit, setEdit] = useState(false),
    [status, setStatus] = useState(false),
    [maintenance, setMaintenance] = useState(false),
    [preview, setPreview] = useState<ScanAsset>(),
    [remove, setRemove] = useState<ScanAsset>(),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const m = state.records["Machines & Equipment"].find(
    (m) => m.id === machineId,
  );
  if (!m?.machine)
    return (
      <Empty>
        Machine not found.{" "}
        <Link to="/machines-equipment">Back to directory</Link>
      </Empty>
    );
  const d = m.machine,
    u = machineUsage(state, m.id),
    tasks = state.records["Maintenance"].filter((t) => t.machineId === m.id),
    bookings = state.appointments
      .filter((a) => a.machineId === m.id && a.date >= DEMO_DATE)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const saveDocs = (documents: ScanAsset[]) =>
    commit(
      (s) =>
        saveMachine(
          s,
          { ...m, machine: { ...d, documents } },
          compatibleTreatments(state, m.id).map((t) => t.id),
          actor,
        ),
      "Machine documents updated",
    );
  return (
    <div className="operations-page">
      <Link className="text-link" to="/machines-equipment">
        ← All machines
      </Link>
      <OperationHeader
        title={m.name}
        description={`${d.brand} · ${d.model} · ${d.serial}`}
        action={
          <div className="operations-actions">
            <button className="button" onClick={() => setEdit(true)}>
              Edit machine
            </button>
            <button className="button primary" onClick={() => setStatus(true)}>
              Set availability
            </button>
          </div>
        }
      />
      <div className="operations-split">
        <Badge>{machineStatus(state, m)}</Badge>
        <small>
          Manual asset record · {roomFor(state, d.roomId)?.room?.code}
        </small>
      </div>
      <nav className="operations-tabs" aria-label="Machine sections">
        {[
          "Overview",
          "Schedule",
          "Session History",
          "Usage",
          "Maintenance",
          "Documents",
        ].map((t) => (
          <button
            className={tab === t ? "active" : ""}
            key={t}
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      {tab === "Overview" && (
        <>
          <Metrics
            items={[
              ["Today's booked minutes", u.minutes],
              [
                "Planning utilisation",
                u.utilisation === null ? "Unavailable" : u.utilisation + "%",
              ],
              ["Linked session records", u.sessions.length],
              ["Recorded closed downtime", u.downtime.toFixed(1) + " h"],
            ]}
          />
          <div className="operations-room-grid">
            <section className="card operations-room">
              <h2>Asset overview</h2>
              <DetailList
                items={[
                  ["Category", d.category],
                  [
                    "Compatible clinic treatments",
                    compatibleTreatments(state, m.id)
                      .map((t) => t.name)
                      .join(", ") || "Not configured",
                  ],
                  ["Last recorded service", d.lastService],
                  ["Next maintenance", d.nextMaintenance],
                  ["Daily planning capacity", d.planningMinutes + " minutes"],
                  ["Device connectivity", "Not connected"],
                  [
                    "Machine runtime",
                    "Unavailable — no runtime source recorded",
                  ],
                ]}
              />
            </section>
            <section className="card operations-room">
              <h2>Availability audit</h2>
              {d.events
                .slice()
                .reverse()
                .map((e) => (
                  <article className="operations-movement" key={e.id}>
                    <strong>{e.action}</strong>
                    <small>
                      {e.status} · {e.actor} ·{" "}
                      {new Date(e.at).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })}{" "}
                      IST
                    </small>
                    <p>{e.note}</p>
                  </article>
                ))}
            </section>
          </div>
        </>
      )}
      {tab === "Schedule" && (
        <section className="card operations-room">
          <h2>Today's and upcoming bookings</h2>
          {bookings.map((a) => (
            <Link
              key={a.id}
              className="operations-mini-row"
              to={"/appointments?appointment=" + a.id + "&date=" + a.date}
            >
              <div>
                <strong>
                  {a.date} · {a.time}
                </strong>
                <small>
                  {a.duration || "Not recorded"} minutes · {a.room}
                </small>
              </div>
              <div>
                {state.patients.find((p) => p.id === a.patientId)?.name}
                <small>
                  {a.treatment} · {a.technician}
                </small>
              </div>
              <Badge>{a.status}</Badge>
            </Link>
          ))}
          {!bookings.length && (
            <Empty>No upcoming bookings for this asset.</Empty>
          )}
        </section>
      )}
      {tab === "Session History" && (
        <section className="card operations-room">
          <h2>Linked sessions and documented parameters</h2>
          {u.sessions.map((r) => (
            <article key={r.id} className="operations-movement">
              <div className="operations-split">
                <Link className="text-link" to={"/sittings-sessions/" + r.id}>
                  {r.id} ·{" "}
                  {state.patients.find((p) => p.id === r.patientId)?.name}
                </Link>
                <Badge>{r.status}</Badge>
              </div>
              <p>
                {r.date} · {r.session?.area} ·{" "}
                {r.session?.operator || "Operator not recorded"}
              </p>
              <DetailList
                items={r.session!.parameterSchema.map((f) => [
                  f.label + (f.unit ? " (" + f.unit + ")" : ""),
                  r.session!.parameters[f.id]?.trim() || "Not recorded",
                ])}
              />
              <small>
                Manually documented settings. No device telemetry or prescribed
                values.
              </small>
            </article>
          ))}
          {!u.sessions.length && (
            <Empty>No session records reference this machine.</Empty>
          )}
        </section>
      )}
      {tab === "Usage" && (
        <section className="card operations-room">
          <h2>Recorded usage</h2>
          <DetailList
            items={[
              ["Operating date", DEMO_DATE],
              ["Booked visits", u.visits.length],
              ["Booked minutes", u.minutes],
              [
                "Planning denominator",
                d.planningMinutes + " minutes/day (clinic configuration)",
              ],
              [
                "Planning utilisation",
                u.utilisation === null ? "Unavailable" : u.utilisation + "%",
              ],
              ["Runtime / telemetry", "Unavailable — no connected device"],
              [
                "Recorded shot counts",
                u.shots === undefined
                  ? "Unavailable — none recorded"
                  : u.shots + " (sum of manually documented session fields)",
              ],
              [
                "Closed service downtime",
                u.downtime.toFixed(1) +
                  " hours from documented start/clearance windows",
              ],
            ]}
          />
          <p>
            Utilisation uses appointment durations and excludes cancellations,
            reschedules, no-shows and waiting-list entries. It is a planning
            estimate, not measured machine runtime. Open service windows remain
            pending.
          </p>
        </section>
      )}
      {tab === "Maintenance" && (
        <section className="card operations-room">
          <div className="operations-split">
            <h2>Service history & clearance</h2>
            <button
              className="button primary"
              onClick={() => setMaintenance(true)}
            >
              Create maintenance task
            </button>
          </div>
          {tasks.map((t) => (
            <article className="operations-movement" key={t.id}>
              <div className="operations-split">
                <strong>{t.name}</strong>
                <Badge>{t.status}</Badge>
              </div>
              <p>
                Due {t.dueDate} · {t.maintenance?.severity} ·{" "}
                {t.maintenance?.assignedTo}
              </p>
              <p>{t.maintenance?.notes}</p>
              <small>
                Service: {t.maintenance?.serviceDate || "Not recorded"} ·{" "}
                {t.maintenance?.serviceNotes || "Clearance pending"}
              </small>
            </article>
          ))}
          {!tasks.length && <Empty>No service tasks recorded.</Empty>}
          <Link className="button" to={"/maintenance?machine=" + m.id}>
            Open maintenance workspace
          </Link>
        </section>
      )}
      {tab === "Documents" && (
        <section className="card operations-room">
          <h2>Asset documents</h2>
          <p>
            Upload fictional service reports or manuals. PDF, PNG, JPEG and
            WebP, up to 650 KB each, eight files / 2 MB total.
          </p>
          <label className="button">
            {loading ? "Reading file…" : "Upload document"}
            <input
              aria-label="Upload machine document"
              disabled={loading}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setError("");
                setLoading(true);
                try {
                  const kind =
                      file.type === "application/pdf" ? "report" : "image",
                    err = validateUpload(file, kind);
                  if (err) throw new Error(err);
                  const asset = await readAsset(file, kind);
                  saveDocs([...d.documents, asset]);
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Upload failed",
                  );
                } finally {
                  setLoading(false);
                  e.target.value = "";
                }
              }}
            />
          </label>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          {d.documents.map((a) => (
            <article className="operations-mini-row" key={a.id}>
              <div>
                <strong>{a.name}</strong>
                <small>{Math.ceil(a.size / 1024)} KB · Manually uploaded</small>
              </div>
              <button className="button" onClick={() => setPreview(a)}>
                Open
              </button>
              <button className="button" onClick={() => setRemove(a)}>
                Remove
              </button>
            </article>
          ))}
          {!d.documents.length && <Empty>No asset documents uploaded.</Empty>}
        </section>
      )}
      {edit && <MachineEditor record={m} onClose={() => setEdit(false)} />}
      {status && (
        <MachineStatusForm record={m} onClose={() => setStatus(false)} />
      )}
      {maintenance && (
        <MaintenanceEditor
          machineId={m.id}
          onClose={() => setMaintenance(false)}
        />
      )}
      {preview && (
        <AssetViewer asset={preview} onClose={() => setPreview(undefined)} />
      )}
      {remove && (
        <Modal
          title="Remove asset document?"
          onClose={() => setRemove(undefined)}
        >
          <p>{remove.name} will be removed from this local asset record.</p>
          <div className="modal-actions">
            <button className="button" onClick={() => setRemove(undefined)}>
              Keep document
            </button>
            <button
              className="button danger"
              onClick={() => {
                if (saveDocs(d.documents.filter((a) => a.id !== remove.id)))
                  setRemove(undefined);
              }}
            >
              Remove document
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
