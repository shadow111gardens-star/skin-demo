import { useState, useEffect, type ChangeEvent } from "react";
import {
  UserRoundPlus,
  ChevronRight,
  ChevronLeft,
  Upload,
  Trash2,
  FileText,
  ScanFace,
  Monitor,
  Check,
  Save,
  ArrowUpRight,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useClinic, addActivity } from "../../store";
import { DEMO_DATE, type RecordItem } from "../../data";
import { Modal, Badge } from "../../components";
import PatientForm from "../patients/PatientForm";
import {
  analysisDevices,
  metricDefinitions,
  scanAreas,
  type MetricKey,
  type ScanAsset,
  type ScanDetails,
} from "./model";
import { demoAssets, readAsset, validateUpload } from "./assets";
import { emptyScan, putScan, reviewReadiness } from "./services";
import { ScanAssetPreview, AssetViewer, ScanSafety } from "./ScanComponents";
interface Props {
  requestCancelRef?: { current: (() => void) | null };
  initialPatientId?: string;
  initialArea?: string;
  existing?: RecordItem;
  date?: string;
  onClose: () => void;
  onSaved: (record: RecordItem, openReview: boolean) => void;
}
export default function ScanWizard({
  requestCancelRef,
  initialPatientId = "",
  initialArea = "Full face",
  existing,
  date = DEMO_DATE,
  onClose,
  onSaved,
}: Props) {
  const { state, setState, notify } = useClinic();
  const [id] = useState(
    existing?.id || `SCAN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
  );
  const [step, setStep] = useState(0);
  const [patientId, setPatientId] = useState(
    existing?.patientId || initialPatientId,
  );
  const [scanDate, setScanDate] = useState(existing?.date || date);
  const [courseId, setCourseId] = useState(existing?.courseId || "");
  const [details, setDetails] = useState<ScanDetails>(() =>
    existing?.scan
      ? structuredClone(existing.scan)
      : {
          ...emptyScan(
            analysisDevices[0].id,
            analysisDevices[0].brand,
            analysisDevices[0].model,
            analysisDevices[0].metrics,
          ),
          area: scanAreas.includes(initialArea) ? initialArea : "Full face",
        },
  );
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [registering, setRegistering] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [view, setView] = useState<ScanAsset | null>(null);
  const patient = state.patients.find((p) => p.id === patientId);
  const courses = state.records["Treatment Plans"].filter(
    (c) => c.patientId === patientId,
  );
  const update = (next: Partial<ScanDetails>) => {
    setDetails((s) => ({ ...s, ...next }));
    setDirty(true);
    setError("");
  };
  const titles = [
    "Patient & device",
    "Capture & source files",
    "Available measurements",
    "Confirm & save",
  ];
  function metadataError() {
    if (!patient) return "Select a registered patient to link this report.";
    if (patient.status === "Archived")
      return "Restore this patient before creating a scan.";
    if (!details.deviceId) return "Select a demo analysis machine.";
    if (
      !scanDate ||
      scanDate > DEMO_DATE ||
      Number.isNaN(new Date(scanDate + "T12:00:00Z").getTime())
    )
      return "Choose a valid scan date on or before 23 Oct 2026.";
    if (!details.brand.trim() || !details.model.trim())
      return "Complete the device brand and model.";
    if (!details.area) return "Select the relevant capture area.";
    return "";
  }
  function next(target: number) {
    const e = metadataError();
    if (target > step && e) {
      setError(e);
      return;
    }
    setStep(target);
    setError("");
  }
  function cancel() {
    if (busy) return;
    if (dirty) setConfirm("discard");
    else onClose();
  }
  useEffect(() => {
    if (requestCancelRef) requestCancelRef.current = cancel;
    return () => {
      if (requestCancelRef) requestCancelRef.current = null;
    };
  });
  async function files(
    e: ChangeEvent<HTMLInputElement>,
    kind: "image" | "report",
  ) {
    const input = e.currentTarget;
    const selected = Array.from(input.files || []);
    if (!selected.length) return;
    const invalid = selected
      .map((f) => validateUpload(f, kind))
      .filter(Boolean);
    if (invalid.length) {
      setError(invalid.join(" "));
      notify("Some files were not accepted.", "error");
      input.value = "";
      return;
    }
    if (
      details.assets.length + selected.length > 8 ||
      details.assets.reduce((n, a) => n + a.size, 0) +
        selected.reduce((n, f) => n + f.size, 0) >
        2000000
    ) {
      setError(
        "Keep this draft to 8 files and 2 MB total so it can be saved locally.",
      );
      input.value = "";
      return;
    }
    setBusy("Reading demo files…");
    setError("");
    try {
      const assets = await Promise.all(selected.map((f) => readAsset(f, kind)));
      update({
        assets: [...details.assets, ...assets],
        captureStatus: "Files uploaded",
        source: "Manual demo upload",
      });
      notify("Demo files attached. No image analysis was performed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Files could not be read.");
      notify("Upload could not be completed.", "error");
    } finally {
      setBusy("");
      input.value = "";
    }
  }
  async function importDemo() {
    setConfirm("");
    setBusy("Preparing demonstration data…");
    await new Promise((resolve) => setTimeout(resolve, 200));
    const selected =
      analysisDevices.find((d) => d.id === details.deviceId) ||
      analysisDevices[0];
    const values: Partial<Record<MetricKey, number>> = {};
    selected.metrics.forEach(
      (key, i) => (values[key] = [34, 42, 28, 21, 63, 31, 47, 65][i]),
    );
    update({
      brand: selected.brand,
      model: selected.model,
      serialNumber: "DEMO-" + selected.id.toUpperCase(),
      assets: demoAssets(Date.now()),
      metrics: values,
      captureStatus: "Imported Demo",
      source: "Simulated import",
      measurementSource: "Demonstration data",
    });
    setBusy("");
    notify("Simulated import ready. No device was connected or synced.");
  }
  function save(openReview: boolean) {
    const e = metadataError();
    if (e) {
      setError(e);
      return;
    }
    if (
      Object.values(details.metrics).some(
        (v) => typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100,
      )
    ) {
      setError(
        "Measurement indices must be between 0 and 100. Leave unavailable values blank.",
      );
      return;
    }
    const record: RecordItem = {
      ...existing,
      id,
      patientId,
      name: patient!.name,
      date: scanDate,
      amount: 0,
      courseId: courseId || undefined,
      status: openReview ? "Awaiting Review" : "Draft",
      detail: `${details.area} scan · ${details.brand} ${details.model} · demonstration report`,
      scan: details,
      measurements: undefined,
      reviewedBy: undefined,
    };
    if (openReview) {
      const readiness = reviewReadiness(record);
      if (readiness) {
        setError(readiness);
        return;
      }
    }
    try {
      const updated = addActivity(
        putScan(state, record),
        `${patient!.name}: ${openReview ? "scan submitted for clinician review" : "scan draft saved"} · ${id}.`,
        patientId,
      );
      localStorage.setItem("mmverse-v1", JSON.stringify(updated));
      setState(updated);
      setDirty(false);
      notify(
        openReview
          ? "Demonstration report is ready for clinician review"
          : "Scan draft saved locally",
      );
      onSaved(record, openReview);
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes("course")
          ? err.message
          : "This draft could not be saved. Check its measurements or free browser storage.",
      );
      notify("Scan was not saved.", "error");
    }
  }
  return (
    <div className="scan-wizard">
      <nav className="scan-stepper" aria-label="Scan creation steps">
        {titles.map((t, i) => (
          <button
            type="button"
            key={t}
            className={step === i ? "current" : step > i ? "done" : ""}
            onClick={() => next(i)}
            disabled={!!busy}
          >
            <span>{step > i ? <Check size={13} /> : i + 1}</span>
            <strong>{t}</strong>
          </button>
        ))}
      </nav>
      <div className="scan-wizard-heading">
        <span>STEP {step + 1} OF 4</span>
        <h2>{titles[step]}</h2>
        <p>
          {
            [
              "Start with an existing patient and a clearly identified demo device.",
              "Keep original files together. Uploads never generate measurements.",
              "Enter only indices provided by this fictional report. Leave unavailable values blank.",
              "Save a draft or send the complete demonstration report to clinician review.",
            ][step]
          }
        </p>
      </div>
      {step === 0 && (
        <div className="scan-form-grid">
          <label className="scan-span-all">
            Patient <span>*</span>
            <div className="scan-patient-selector">
              <select
                aria-label="Patient"
                value={patientId}
                disabled={!!initialPatientId || !!existing}
                onChange={(e) => {
                  setPatientId(e.target.value);
                  setCourseId("");
                  setDirty(true);
                  setError("");
                }}
              >
                <option value="">Select a patient</option>
                {state.patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.id}
                  </option>
                ))}
              </select>
              {!initialPatientId && !existing && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setRegistering(true)}
                >
                  <UserRoundPlus size={14} />
                  Register patient
                </button>
              )}
            </div>
            {patient && (
              <small>
                {patient.phone} ·{" "}
                {patient.assignedDoctor || "Doctor not assigned"} · linked to{" "}
                {patient.id}
              </small>
            )}
          </label>
          <label className="scan-span-all">
            Demo analysis machine <span>*</span>
            <select
              aria-label="Demo analysis machine"
              value={details.deviceId}
              onChange={(e) => {
                const d = analysisDevices.find((d) => d.id === e.target.value)!;
                if (
                  details.assets.length ||
                  Object.keys(details.metrics).length
                ) {
                  setConfirm("device:" + d.id);
                  return;
                }
                update({
                  deviceId: d.id,
                  brand: d.brand,
                  model: d.model,
                  supportedMetrics: d.metrics,
                  metrics: {},
                });
              }}
            >
              {analysisDevices.map((d) => (
                <option value={d.id} key={d.id}>
                  {d.brand} · {d.model} (Demo)
                </option>
              ))}
            </select>
          </label>
          <div className="scan-device-card scan-span-all">
            <Monitor size={27} />
            <div>
              <strong>
                {details.brand} {details.model}
              </strong>
              <p>
                {
                  analysisDevices.find((d) => d.id === details.deviceId)
                    ?.description
                }
              </p>
              <Badge>Simulated only</Badge>
            </div>
            <span className="scan-no-connection">No device connected</span>
          </div>
          <label>
            Scan date (IST) <span>*</span>
            <input
              aria-label="Scan date"
              type="date"
              value={scanDate}
              max={DEMO_DATE}
              onChange={(e) => {
                setScanDate(e.target.value);
                setDirty(true);
                setError("");
              }}
            />
          </label>
          <label>
            Capture area <span>*</span>
            <select
              aria-label="Capture area"
              value={details.area}
              onChange={(e) => update({ area: e.target.value })}
            >
              {scanAreas.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      {step === 1 && (
        <>
          <div className="scan-import-banner">
            <span className="round-symbol sage-bg">
              <RefreshCw size={19} />
            </span>
            <div>
              <strong>Try a demonstration capture</strong>
              <p>
                Add labelled example files and measurements. No real machine
                connects or syncs.
              </p>
            </div>
            <button
              type="button"
              className="button secondary"
              disabled={!!busy}
              onClick={() =>
                details.assets.length || Object.keys(details.metrics).length
                  ? setConfirm("import")
                  : void importDemo()
              }
            >
              Simulate device import
            </button>
          </div>
          <div className="scan-upload-grid">
            <label className="scan-upload-zone">
              <FileText size={23} />
              <strong>Attach a demonstration report</strong>
              <small>PDF · under 650 KB per file</small>
              <input
                aria-label="Upload demo report files"
                type="file"
                accept="application/pdf"
                multiple
                disabled={!!busy}
                onChange={(e) => void files(e, "report")}
              />
            </label>
            <label className="scan-upload-zone">
              <Upload size={23} />
              <strong>Attach fictional facial images</strong>
              <small>JPG, PNG or WebP · under 650 KB each</small>
              <input
                aria-label="Upload demo facial images"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={!!busy}
                onChange={(e) => void files(e, "image")}
              />
            </label>
          </div>
          {details.assets.length > 0 && (
            <div className="scan-upload-list">
              {details.assets.map((a) => (
                <div key={a.id} className="scan-upload-row">
                  <span className="upload-file-icon">
                    {a.kind === "image" ? (
                      <ScanFace size={19} />
                    ) : (
                      <FileText size={19} />
                    )}
                  </span>
                  <span>
                    <strong>{a.name}</strong>
                    <small>
                      {a.kind === "image" ? "Image" : "PDF report"} ·{" "}
                      {Math.max(1, Math.round(a.size / 1000))} KB{" "}
                      {a.demonstration ? "· seeded demonstration" : ""}
                    </small>
                  </span>
                  {a.kind === "image" && (
                    <select
                      aria-label={`View for ${a.name}`}
                      value={a.view || "Front"}
                      onChange={(e) =>
                        update({
                          assets: details.assets.map((asset) =>
                            asset.id === a.id
                              ? { ...asset, view: e.target.value }
                              : asset,
                          ),
                        })
                      }
                    >
                      {["Front", "Left oblique", "Right oblique", "Detail"].map(
                        (v) => (
                          <option key={v}>{v}</option>
                        ),
                      )}
                    </select>
                  )}
                  <button
                    type="button"
                    className="icon"
                    aria-label={`Preview ${a.name}`}
                    onClick={() => setView(a)}
                  >
                    <ArrowUpRight size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon"
                    aria-label={`Remove ${a.name}`}
                    disabled={!!busy}
                    onClick={() =>
                      update({
                        assets: details.assets.filter(
                          (asset) => asset.id !== a.id,
                        ),
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {details.assets.some((a) => a.kind === "image") && (
            <div className="scan-upload-previews">
              {details.assets
                .filter((a) => a.kind === "image")
                .map((a) => (
                  <ScanAssetPreview
                    key={a.id}
                    asset={a}
                    caption={
                      a.demonstration
                        ? "Demonstration face map · not a patient photograph"
                        : "Original uploaded demo image"
                    }
                    onExpand={() => setView(a)}
                  />
                ))}
            </div>
          )}
          <div className="scan-form-grid">
            <label>
              Device brand <span>*</span>
              <input
                aria-label="Device brand"
                value={details.brand}
                onChange={(e) => update({ brand: e.target.value })}
              />
            </label>
            <label>
              Device model <span>*</span>
              <input
                aria-label="Device model"
                value={details.model}
                onChange={(e) => update({ model: e.target.value })}
              />
            </label>
            <label className="scan-span-all">
              Device reference / serial (optional)
              <input
                aria-label="Device serial"
                value={details.serialNumber}
                onChange={(e) => update({ serialNumber: e.target.value })}
                placeholder="Fictional device reference"
              />
            </label>
          </div>
          <label className="checkbox scan-consent">
            <input
              type="checkbox"
              checked={details.consent}
              onChange={(e) => update({ consent: e.target.checked })}
            />
            I confirm these are fictional/demo assets and relevant capture
            consent is recorded.
          </label>
        </>
      )}
      {step === 2 && (
        <>
          <div className="scan-measurement-note">
            <ShieldCheck size={17} />
            <span>
              Available measurements only. Blank fields are omitted from the
              report; uploaded images are never analysed.
            </span>
          </div>
          <div className="scan-entry-metrics">
            {details.supportedMetrics.map((key) => (
              <label key={key}>
                {metricDefinitions[key].label}
                <div>
                  <input
                    aria-label={metricDefinitions[key].label}
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="Not provided"
                    value={details.metrics[key] ?? ""}
                    onChange={(e) => {
                      const metrics = { ...details.metrics };
                      if (e.target.value === "") delete metrics[key];
                      else metrics[key] = Number(e.target.value);
                      update({
                        metrics,
                        measurementSource: "Manual demonstration entries",
                      });
                    }}
                  />
                  <span>/100</span>
                </div>
                <small>Demonstration index</small>
              </label>
            ))}
          </div>
          <label className="scan-course-select">
            Link a treatment course (optional)
            <select
              aria-label="Linked treatment course"
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setDirty(true);
              }}
            >
              <option value="">No course linked</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.detail.split(" · ")[0]} · {c.status} · {c.id}
                </option>
              ))}
            </select>
          </label>
          <p className="scan-caption">
            Only this patient’s existing treatment courses are available. This
            does not create a new patient or prescribe a plan.
          </p>
        </>
      )}
      {step === 3 && (
        <>
          <div className="scan-confirm-grid">
            <div>
              <small>Patient</small>
              <strong>{patient?.name}</strong>
              <span>{patientId}</span>
            </div>
            <div>
              <small>Capture</small>
              <strong>
                {details.area} · {scanDate}
              </strong>
              <span>{id}</span>
            </div>
            <div>
              <small>Device</small>
              <strong>
                {details.brand} {details.model}
              </strong>
              <Badge>{details.captureStatus}</Badge>
            </div>
            <div>
              <small>Source records</small>
              <strong>
                {details.assets.length} files ·{" "}
                {Object.keys(details.metrics).length} measurements
              </strong>
              <span>
                {details.consent
                  ? "Capture consent recorded"
                  : "Consent pending · draft only"}
              </span>
            </div>
          </div>
          <ScanSafety />
          <p className="scan-save-hint">
            Saving a draft keeps this record editable. Opening doctor review
            submits the complete report as Awaiting Review. No recommendation is
            generated.
          </p>
        </>
      )}
      {busy && (
        <div className="scan-busy" role="status">
          <RefreshCw size={15} />
          {busy}
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="scan-wizard-actions">
        <button
          type="button"
          className="button secondary"
          onClick={cancel}
          disabled={!!busy}
        >
          Cancel
        </button>
        {step > 0 && (
          <button
            type="button"
            className="button secondary"
            onClick={() => next(step - 1)}
            disabled={!!busy}
          >
            <ChevronLeft size={14} />
            Back
          </button>
        )}
        {step < 3 ? (
          <button
            type="button"
            className="button primary"
            onClick={() => next(step + 1)}
            disabled={!!busy}
          >
            Continue
            <ChevronRight size={14} />
          </button>
        ) : (
          <>
            <button
              type="button"
              className="button secondary"
              onClick={() => save(false)}
              disabled={!!busy}
            >
              <Save size={14} />
              Save draft
            </button>
            <button
              type="button"
              className="button primary"
              onClick={() => save(true)}
              disabled={!!busy}
            >
              Save & open doctor review
              <ChevronRight size={14} />
            </button>
          </>
        )}
      </div>
      {registering && (
        <PatientForm
          onClose={() => setRegistering(false)}
          onSaved={(p) => {
            setPatientId(p.id);
            setCourseId("");
            setDirty(true);
          }}
          onExisting={(p) => {
            setPatientId(p.id);
            setCourseId("");
            setDirty(true);
          }}
        />
      )}
      {view && <AssetViewer asset={view} onClose={() => setView(null)} />}{" "}
      {confirm && (
        <Modal
          title={
            confirm === "discard"
              ? "Discard unsaved scan changes?"
              : confirm === "import"
                ? "Replace capture with demo import?"
                : "Change demo device?"
          }
          onClose={() => setConfirm("")}
        >
          <p>
            {confirm === "discard"
              ? "Your unsaved capture details and attachments will be discarded. Saved patient records are retained."
              : confirm === "import"
                ? "Replace this draft’s attachments and measurements with clearly labelled demonstration data? No device will connect."
                : "Changing the demo device clears the current attachments and measurements so incompatible data is not carried across."}
          </p>
          <div className="form-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => setConfirm("")}
            >
              Keep editing
            </button>
            <button
              type="button"
              className={`button ${confirm === "discard" ? "danger" : "primary"}`}
              onClick={() => {
                if (confirm === "discard") onClose();
                else if (confirm === "import") void importDemo();
                else {
                  const d = analysisDevices.find(
                    (d) => d.id === confirm.split(":")[1],
                  )!;
                  update({
                    deviceId: d.id,
                    brand: d.brand,
                    model: d.model,
                    supportedMetrics: d.metrics,
                    metrics: {},
                    assets: [],
                    source: "Manual demo upload",
                    captureStatus: "Draft",
                  });
                  setConfirm("");
                }
              }}
            >
              {confirm === "discard"
                ? "Discard changes"
                : confirm === "import"
                  ? "Use demonstration data"
                  : "Change device"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
