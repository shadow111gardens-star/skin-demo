import { clinicDoctors } from "../admin/access";
﻿import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useClinic, addActivity } from "../../store";
import { Badge, Modal } from "../../components";
import {
  canReviewScan,
  canCreateScan,
  scanAreas,
  type ScanAsset,
} from "./model";
import {
  compatibleScans,
  comparableMetrics,
  saveComparisonNote,
} from "./services";
import { ScanAssetPreview, AssetViewer, ScanSafety } from "./ScanComponents";
import type { Role } from "../../auth";
export default function ScanComparison({ role }: { role: Role }) {
  const { state, setState, notify } = useClinic();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [patientId, setPatient] = useState(
    params.get("patientId") || state.patients[0]?.id || "",
  );
  const [area, setArea] = useState(
    state.records["Skin Analysis"].find((r) => r.id === params.get("followup"))
      ?.scan?.area || "Full face",
  );
  const all = state.records["Skin Analysis"]
    .filter((r) => r.patientId === patientId && r.scan?.area === area)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const [baselineId, setBaseline] = useState(params.get("baseline") || "");
  const [followupId, setFollowup] = useState(params.get("followup") || "");
  const baseline = all.find((r) => r.id === baselineId) || all[0];
  const followup = all.find((r) => r.id === followupId) || all[all.length - 1];
  const valid = !!baseline && !!followup && compatibleScans(baseline, followup);
  const [view, setView] = useState("Front");
  const [mobile, setMobile] = useState("baseline");
  const [asset, setAsset] = useState<ScanAsset | null>(null);
  const [note, setNote] = useState("");
  const [ack, setAck] = useState(false);
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);
  const [pendingPath, setPendingPath] = useState("");
  function go(path: string) {
    if (note.trim()) {
      setPendingPath(path);
      setDiscard(true);
    } else navigate(path);
  }
  const [doctor, setDoctor] = useState("Dr. Mehta");
  const [start, setStart] = useState(0);
  const metrics = valid ? comparableMetrics(baseline, followup) : [];
  const patient = state.patients.find((p) => p.id === patientId);
  function save() {
    if (!valid || !note.trim() || !ack) {
      setError(
        "Choose a valid comparison, enter a clinician note and confirm review.",
      );
      return;
    }
    try {
      const updated = addActivity(
        saveComparisonNote(state, baseline.id, followup.id, doctor, note),
        patient?.name + ": clinician progress note saved for scan comparison.",
        patientId,
      );
      localStorage.setItem("mmverse-v1", JSON.stringify(updated));
      setState(updated);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Progress note could not be saved.",
      );
      notify("Progress note was not saved.", "error");
      return;
    }
    setNote("");
    setAck(false);
    setError("");
    notify("Progress note saved to the patient record");
  }
  return (
    <div className="scan-comparison">
      <button className="text-button" onClick={() => go("/skin-analysis")}>
        ← Scan library
      </button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LONGITUDINAL CLINICAL RECORD</div>
          <h1>Before & after comparison</h1>
          <p>
            Compare original captures. Record the clinician’s interpretation.
          </p>
        </div>
      </div>
      <ScanSafety />
      <section className="card scan-comparison-controls">
        <label>
          Patient
          <select
            aria-label="Comparison patient"
            disabled={!!note.trim()}
            value={patientId}
            onChange={(e) => {
              setPatient(e.target.value);
              setNote("");
              setAck(false);
              setBaseline("");
              setFollowup("");
            }}
          >
            {state.patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Capture area
          <select
            aria-label="Comparison area"
            disabled={!!note.trim()}
            value={area}
            onChange={(e) => {
              setArea(e.target.value);
              setNote("");
              setAck(false);
              setBaseline("");
              setFollowup("");
            }}
          >
            {scanAreas.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label>
          Baseline
          <select
            aria-label="Baseline scan"
            disabled={!!note.trim()}
            value={baseline?.id || ""}
            onChange={(e) => {
              setBaseline(e.target.value);
              setNote("");
              setAck(false);
            }}
          >
            {all.map((r) => (
              <option key={r.id} value={r.id}>
                {r.date} · {r.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Follow-up
          <select
            aria-label="Follow-up scan"
            disabled={!!note.trim()}
            value={followup?.id || ""}
            onChange={(e) => {
              setFollowup(e.target.value);
              setNote("");
              setAck(false);
            }}
          >
            {all.map((r) => (
              <option key={r.id} value={r.id}>
                {r.date} · {r.id}
              </option>
            ))}
          </select>
        </label>
      </section>
      {all.length < 2 ? (
        <section className="card empty">
          <h2>No comparison available</h2>
          <p>
            This patient needs two scans of the same area. Existing reports
            remain available in the library.
          </p>
          {canCreateScan(role) && (
            <button
              className="button primary"
              onClick={() =>
                go(
                  `/skin-analysis/new?patientId=${patientId}&area=${encodeURIComponent(area)}`,
                )
              }
            >
              Create follow-up scan
            </button>
          )}
        </section>
      ) : !valid ? (
        <div className="form-error" role="alert">
          Select different scans with the follow-up on or after the baseline
          date.
        </div>
      ) : (
        <>
          <div className="scan-compare-toolbar">
            <label>
              Image view
              <select value={view} onChange={(e) => setView(e.target.value)}>
                {["Front", "Left oblique", "Right oblique", "Detail"].map(
                  (v) => (
                    <option key={v}>{v}</option>
                  ),
                )}
              </select>
            </label>
            <button
              className="text-button"
              onClick={() => go("/patients/" + patientId)}
            >
              Open {patient?.name}’s profile ↗
            </button>
          </div>
          <div
            className="scan-mobile-tabs"
            role="tablist"
            aria-label="Comparison images"
          >
            {["baseline", "followup"].map((v) => (
              <button
                role="tab"
                aria-selected={mobile === v}
                key={v}
                onClick={() => setMobile(v)}
              >
                {v === "baseline" ? "Baseline" : "Follow-up"}
              </button>
            ))}
          </div>
          <div
            className="scan-compare-images"
            onTouchStart={(e) => setStart(e.changedTouches[0].clientX)}
            onTouchEnd={(e) => {
              const delta = e.changedTouches[0].clientX - start;
              if (Math.abs(delta) > 45)
                setMobile(delta < 0 ? "followup" : "baseline");
            }}
          >
            {[baseline, followup].map((r, i) => {
              const image = r.scan?.assets.find(
                (a) => a.kind === "image" && (a.view || "Front") === view,
              );
              return (
                <section
                  key={r.id}
                  className={`card scan-compare-image ${mobile === (i ? "followup" : "baseline") ? "mobile-selected" : ""}`}
                >
                  <header>
                    <div>
                      <small>{i ? "FOLLOW-UP" : "BASELINE"}</small>
                      <h2>{r.date}</h2>
                    </div>
                    <Badge>{r.status}</Badge>
                  </header>
                  {image ? (
                    <ScanAssetPreview
                      asset={image}
                      caption={`${view} · ${area}`}
                      onExpand={() => setAsset(image)}
                    />
                  ) : (
                    <div className="empty">
                      No {view.toLowerCase()} image available.
                    </div>
                  )}
                  <button
                    className="text-button"
                    onClick={() => go("/skin-analysis/" + r.id)}
                  >
                    Open source report ↗
                  </button>
                  <h3>Doctor observations</h3>
                  <p>
                    {r.scan?.observations ||
                      "No clinician observations recorded."}
                  </p>
                </section>
              );
            })}
          </div>
          <section className="card scan-difference-card">
            <h2>Supported metric differences</h2>
            <p>
              Demonstration indices only. Changes do not imply improvement or a
              diagnosis.
            </p>
            {metrics.length ? (
              metrics.map((m) => (
                <div className="scan-difference-row" key={m.key}>
                  <strong>{m.label}</strong>
                  <span>
                    {m.baseline} → {m.followup}
                  </span>
                  <Badge>{`${m.delta > 0 ? "+" : ""}${m.delta} points`}</Badge>
                </div>
              ))
            ) : (
              <div className="empty">
                No shared measurements are available for these reports.
              </div>
            )}
          </section>
          {canReviewScan(role) && (
            <section className="card scan-progress-note">
              <h2>Clinician progress note</h2>
              <label>
                Recording clinician
                <select
                  aria-label="Progress note doctor"
                  value={doctor}
                  onChange={(e) => setDoctor(e.target.value)}
                >
                  {clinicDoctors(state).map(d => <option key={d}>{d}</option>)}
                </select>
              </label>
              <p>
                Saved with the source scan IDs and current metric comparison.
              </p>
              <label>
                Progress note
                <textarea
                  aria-label="Progress note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Enter your clinical observations and agreed next step…"
                />
              </label>
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                I have reviewed these source reports and this note.
              </label>
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <button className="button primary" onClick={save}>
                Save Progress Note
              </button>
              {note.trim() && (
                <>
                  <button
                    className="button secondary"
                    onClick={() => setDiscard(true)}
                  >
                    Discard note
                  </button>
                  <p className="scan-caption">
                    Save or discard this note before changing the comparison.
                  </p>
                </>
              )}
            </section>
          )}
        </>
      )}{" "}
      <section className="card scan-progress-note">
        <h2>Saved progress notes</h2>
        {state.records["Clinical Documents"]
          .filter((r) => r.patientId === patientId && r.scanComparison)
          .map((r) => (
            <article className="saved-progress-note" key={r.id}>
              <small>
                {r.date} | {r.doctor} | {r.scanComparison?.area}
              </small>
              <p>{r.detail}</p>
              <button
                className="text-button"
                onClick={() =>
                  go("/patients/" + patientId + "?tab=Consents+%26+Documents")
                }
              >
                Open patient documents
              </button>
            </article>
          ))}
        {!state.records["Clinical Documents"].some(
          (r) => r.patientId === patientId && r.scanComparison,
        ) && <p>No comparison notes saved yet.</p>}
      </section>
      {discard && (
        <Modal
          title="Discard unsaved progress note?"
          onClose={() => {
            setDiscard(false);
            setPendingPath("");
          }}
        >
          <p>The current note has not been saved to the patient record.</p>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => {
                setDiscard(false);
                setPendingPath("");
              }}
            >
              Keep editing
            </button>
            <button
              className="button danger"
              onClick={() => {
                setNote("");
                setAck(false);
                setDiscard(false);
                if (pendingPath) navigate(pendingPath);
                setPendingPath("");
              }}
            >
              Discard note
            </button>
          </div>
        </Modal>
      )}
      {asset && <AssetViewer asset={asset} onClose={() => setAsset(null)} />}
    </div>
  );
}
