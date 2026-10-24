import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  ScanFace,
  ClipboardCheck,
  Files,
  Pencil,
  CalendarDays,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { useClinic, addActivity } from "../../store";
import { Avatar, Badge, SectionTitle } from "../../components";
import { dayLabel } from "../../services";
import { type ScanAsset, canCreateScan, canReviewScan } from "./model";
import { reviewReadiness, putScan } from "./services";
import {
  ScanSafety,
  MetricPanels,
  ScanAssetPreview,
  AssetViewer,
} from "./ScanComponents";
import type { Role } from "../../auth";
export default function ScanReport({
  role,
  onCourse,
}: {
  role: Role;
  onCourse: (id: string) => void;
}) {
  const { scanId } = useParams();
  const { state, setState, notify } = useClinic();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<ScanAsset | null>(null);
  const r = state.records["Skin Analysis"].find((r) => r.id === scanId);
  if (!r?.scan)
    return (
      <section className="card scan-not-found">
        <ScanFace size={29} />
        <h1>Scan report not found</h1>
        <p>This record is not available in the local scan library.</p>
        <button
          className="button primary"
          onClick={() => navigate("/skin-analysis")}
        >
          Back to scan library
        </button>
      </section>
    );
  const scan = r.scan;
  const p = state.patients.find((p) => p.id === r.patientId);
  const course = state.records["Treatment Plans"].find(
    (c) => c.id === r.courseId,
  );
  const images = scan.assets.filter((a) => a.kind === "image"),
    reports = scan.assets.filter((a) => a.kind === "report");
  const ready = reviewReadiness(r);
  const openReview = () => {
    if (!canCreateScan(role)) {
      navigate("/skin-analysis/" + r.id + "/review");
      return;
    }
    if (r.status === "Draft" && ready) {
      notify(ready, "error");
      navigate("/skin-analysis/" + r.id + "/edit");
      return;
    }
    if (r.status === "Draft") {
      setState((s) =>
        addActivity(
          putScan(s, { ...r, status: "Awaiting Review" }),
          `${p?.name}: scan ${r.id} submitted for clinician review.`,
          r.patientId,
        ),
      );
    }
    navigate("/skin-analysis/" + r.id + "/review");
  };
  return (
    <div className="analysis-report">
      <button
        className="text-button scan-back"
        onClick={() => navigate("/skin-analysis")}
      >
        <ArrowLeft size={14} />
        Scan library
      </button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SCAN REPORT · {r.id}</div>
          <h1>{scan.area} analysis report</h1>
          <p>
            Source files and recorded observations, in one clinical workspace.
          </p>
        </div>
        <div className="heading-actions">
          <button
            className="button secondary"
            onClick={() =>
              navigate(
                `/skin-analysis/compare?patientId=${r.patientId}&followup=${encodeURIComponent(r.id)}`,
              )
            }
          >
            <Files size={15} />
            Compare scans
          </button>
          {canCreateScan(role) && r.status === "Draft" && (
            <button
              className="button secondary"
              onClick={() => navigate("/skin-analysis/" + r.id + "/edit")}
            >
              <Pencil size={14} />
              Edit draft
            </button>
          )}
          <button className="button primary" onClick={openReview}>
            <ClipboardCheck size={15} />
            {canReviewScan(role) ? "Doctor review" : "Review status"}
          </button>
        </div>
      </div>
      <div className="scan-patient-context">
        <button
          className="patient-cell"
          onClick={() => p && navigate("/patients/" + p.id)}
        >
          <Avatar name={p?.name || r.name} />
          <span>
            <strong>
              {p?.name || r.name}
              <ArrowUpRight size={12} />
            </strong>
            <small>
              {r.patientId} · {p?.age} years · {p?.assignedDoctor}
            </small>
          </span>
        </button>
        <span>
          <CalendarDays size={14} />
          {r.date ? dayLabel(r.date) : "Date not recorded"}
        </span>
        <Badge>{scan.captureStatus}</Badge>
        <Badge>{r.status}</Badge>
      </div>
      <ScanSafety />
      <div className="scan-report-grid">
        <div className="scan-report-primary">
          <section className="card scan-images-card">
            <SectionTitle title="Original captures" />
            <p className="scan-section-caption">
              Full frames are preserved. No crops, enhancement or measurements
              are generated.
            </p>
            <div className="scan-report-image-grid">
              {images.map((a) => (
                <ScanAssetPreview
                  asset={a}
                  key={a.id}
                  caption={`${a.view || "Original view"} · ${scan.area} · ${r.date ? dayLabel(r.date) : ""}${a.demonstration ? " · illustrative face map" : ""}`}
                  onExpand={() => setAsset(a)}
                />
              ))}
            </div>
            {!images.length && (
              <div className="scan-inline-empty">
                <ScanFace size={23} />
                <span>No facial images attached to this report.</span>
              </div>
            )}
            {reports.length > 0 && (
              <div className="scan-source-reports">
                {reports.map((a) => (
                  <button key={a.id} onClick={() => setAsset(a)}>
                    <FileText size={18} />
                    <span>
                      <strong>{a.name}</strong>
                      <small>Original PDF source report</small>
                    </span>
                    <ArrowUpRight size={14} />
                  </button>
                ))}
              </div>
            )}
          </section>
          <section className="card scan-measurements-card">
            <SectionTitle title="Available report measurements" />
            <p className="scan-section-caption">
              {scan.measurementSource} · only supplied indices are shown.
            </p>
            <MetricPanels record={r} />
          </section>
          <section className="card scan-observations-card">
            <SectionTitle
              title="Doctor observations"
              action={canReviewScan(role) ? "Open review" : undefined}
              onClick={openReview}
            />
            <div className="scan-observation-body">
              <Badge>{r.status}</Badge>
              <p>
                {scan.observations ||
                  "No clinician observations recorded yet. This report is awaiting a considered review."}
              </p>
              <h3>Clinician-entered recommendations</h3>
              <p>{scan.recommendations || "No recommendations recorded."}</p>
              <h3>Next step</h3>
              <p>
                {scan.nextStep ||
                  "Await clinician review before deciding the next clinical step."}
              </p>
              <small>
                Observations and recommendations are entered by a clinician. No
                medical advice is generated automatically.
              </small>
            </div>
          </section>
        </div>
        <aside className="scan-report-sidebar">
          <section className="card scan-metadata">
            <SectionTitle title="Capture details" />
            <dl>
              <dt>Scan ID</dt>
              <dd>{r.id}</dd>
              <dt>Scan date</dt>
              <dd>{r.date ? dayLabel(r.date) : "Not recorded"} · IST</dd>
              <dt>Device brand</dt>
              <dd>{scan.brand}</dd>
              <dt>Device model</dt>
              <dd>{scan.model}</dd>
              <dt>Device reference</dt>
              <dd>{scan.serialNumber || "Not recorded"}</dd>
              <dt>Capture area</dt>
              <dd>{scan.area}</dd>
              <dt>Import source</dt>
              <dd>
                {scan.source}
                <small>No device connected or synced</small>
              </dd>
            </dl>
          </section>
          <section className="card scan-review-summary">
            <SectionTitle title="Review & consent" />
            <div>
              <Badge>{r.status}</Badge>
              <p>
                <strong>
                  {r.reviewedBy ||
                    r.doctor ||
                    p?.assignedDoctor ||
                    "Doctor not assigned"}
                </strong>
                <small>
                  {r.reviewedBy ? "Review recorded" : "Reviewing clinician"}
                </small>
              </p>
              <span
                className={
                  scan.consent ? "scan-consent-ok" : "scan-consent-pending"
                }
              >
                <ShieldCheck size={15} />
                {scan.consent
                  ? "Capture consent recorded"
                  : "Capture consent pending"}
              </span>
              {ready && <p className="scan-readiness-note">{ready}</p>}
            </div>
          </section>
          <section className="card scan-linked-course">
            <SectionTitle title="Linked treatment course" />
            {course ? (
              <button onClick={() => onCourse(course.id)}>
                <span className="round-symbol sage-bg">
                  <Files size={18} />
                </span>
                <span>
                  <strong>{course.detail.split(" · ")[0]}</strong>
                  <small>{course.id}</small>
                  <Badge>{course.status}</Badge>
                </span>
                <ArrowUpRight size={15} />
              </button>
            ) : (
              <div className="scan-small-empty">
                No course linked. A clinician can link an existing plan during
                review.
              </div>
            )}
          </section>
          <section className="scan-record-footer">
            <ShieldCheck size={16} />
            <p>
              Fictional report, stored in this browser. Original uploads are not
              analysed.
            </p>
          </section>
        </aside>
      </div>
      {asset && <AssetViewer asset={asset} onClose={() => setAsset(null)} />}
    </div>
  );
}
