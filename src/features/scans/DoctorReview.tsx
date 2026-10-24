import { clinicDoctors } from "../admin/access";
import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Save,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import { useClinic, addActivity } from "../../store";
import { Badge, Modal, SectionTitle } from "../../components";
import { doctors } from "../../patientServices";
import { canReviewScan, canCreateScan, type ReportStatus } from "./model";
import { saveScanReview, reviewReadiness } from "./services";
import { ScanSafety } from "./ScanComponents";
import type { Role } from "../../auth";
export default function DoctorReview({
  role,
  onCourse,
}: {
  role: Role;
  onCourse: (id: string) => void;
}) {
  const { scanId } = useParams();
  const { state, setState, notify } = useClinic();
  const navigate = useNavigate();
  const r = state.records["Skin Analysis"].find((r) => r.id === scanId);
  const [doctor, setDoctor] = useState(
    r?.reviewedBy ||
      r?.doctor ||
      state.patients.find((p) => p.id === r?.patientId)?.assignedDoctor ||
      doctors[0],
  );
  const [status, setStatus] = useState<ReportStatus>(
    r?.status === "Reviewed" ? "Reviewed" : "Awaiting Review",
  );
  const [observations, setObservations] = useState(r?.scan?.observations || "");
  const [recommendations, setRecommendations] = useState(
    r?.scan?.recommendations || "",
  );
  const [nextStep, setNextStep] = useState(r?.scan?.nextStep || "");
  const [note, setNote] = useState("");
  const [courseId, setCourseId] = useState(r?.courseId || "");
  const [ack, setAck] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [cancel, setCancel] = useState(false);
  if (!r?.scan)
    return (
      <section className="card scan-not-found">
        <h1>Review record not found</h1>
        <button
          className="button primary"
          onClick={() => navigate("/skin-analysis")}
        >
          Back to scan library
        </button>
      </section>
    );
  const p = state.patients.find((p) => p.id === r.patientId);
  const courses = state.records["Treatment Plans"].filter(
    (c) => c.patientId === r.patientId,
  );
  const reportUrl = "/skin-analysis/" + r.id;
  const readiness = reviewReadiness(r);
  const back = () => (dirty ? setCancel(true) : navigate(reportUrl));
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!canReviewScan(role)) {
      setError(
        "Select the Doctor or Clinic Owner demo role to record a clinician review.",
      );
      return;
    }
    if (status === "Reviewed" && !ack) {
      setError("Confirm clinician review before marking this report reviewed.");
      return;
    }
    try {
      const updated = addActivity(
        saveScanReview(state, r!.id, {
          doctor,
          status,
          observations,
          recommendations,
          nextStep,
          note,
          courseId: courseId || undefined,
        }),
        `${p?.name}: scan ${r!.id} ${status === "Reviewed" ? "reviewed" : "review saved awaiting review"} by ${doctor}.`,
        r!.patientId,
      );
      localStorage.setItem("mmverse-v1", JSON.stringify(updated));
      setState(updated);
      notify(
        status === "Reviewed"
          ? "Clinician review recorded"
          : "Review notes saved; report remains awaiting review",
      );
      navigate(reportUrl);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Review could not be saved.",
      );
      notify("Review was not saved.", "error");
    }
  }
  return (
    <div className="doctor-review-page">
      <button className="text-button scan-back" onClick={back}>
        <ArrowLeft size={14} />
        Back to report
      </button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CLINICIAN-LED REVIEW · {r.id}</div>
          <h1>Doctor review</h1>
          <p>
            {p?.name} · {r.patientId} · {r.scan.area} · {r.date}
          </p>
        </div>
        <Badge>{r.status}</Badge>
      </div>
      <ScanSafety />
      {readiness && (
        <div className="scan-incomplete">
          <ShieldCheck size={18} />
          <span>{readiness}</span>
          {r.status === "Draft" && canCreateScan(role) && (
            <button
              className="text-button"
              onClick={() => navigate(reportUrl + "/edit")}
            >
              Complete draft
              <ArrowUpRight size={13} />
            </button>
          )}
        </div>
      )}
      <div className="scan-review-grid">
        <section className="card doctor-review-form">
          <SectionTitle title="Clinical observations & review" />
          {canReviewScan(role) ? (
            <form onSubmit={submit} onChange={() => setDirty(true)}>
              <div className="scan-form-grid">
                <label>
                  Reviewing doctor
                  <select
                    aria-label="Reviewing doctor"
                    value={doctor}
                    onChange={(e) => setDoctor(e.target.value)}
                  >
                    {clinicDoctors(state).map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Review status
                  <select
                    aria-label="Review status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ReportStatus)}
                  >
                    <option>Awaiting Review</option>
                    <option>Reviewed</option>
                  </select>
                </label>
              </div>
              <label>
                Clinician observations{status === "Reviewed" ? " *" : ""}
                <textarea
                  aria-label="Clinician observations"
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Record observations after reviewing the original report and source images"
                  minLength={status === "Reviewed" ? 5 : undefined}
                  required={status === "Reviewed"}
                />
              </label>
              <label>
                Clinician-entered recommendations (optional)
                <textarea
                  aria-label="Clinician recommendations"
                  value={recommendations}
                  onChange={(e) => setRecommendations(e.target.value)}
                  placeholder="Enter or approve recommendations in your own words. Nothing is generated."
                />
              </label>
              <label>
                Next step (optional)
                <input
                  aria-label="Clinical next step"
                  value={nextStep}
                  onChange={(e) => setNextStep(e.target.value)}
                  placeholder="e.g. Discuss at the next clinician-led consultation"
                />
              </label>
              <label>
                Link an existing course / treatment plan
                <select
                  aria-label="Review linked course"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                >
                  <option value="">No course linked</option>
                  {courses.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.detail.split(" · ")[0]} · {c.status} · {c.id}
                    </option>
                  ))}
                </select>
                <small>Only existing courses for {p?.name} are shown.</small>
              </label>
              <label>
                Add a review note (optional)
                <textarea
                  aria-label="Review note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Additional documentation, limitations or context"
                />
              </label>
              {status === "Reviewed" && (
                <label className="checkbox">
                  <input
                    aria-label="Confirm clinician review"
                    type="checkbox"
                    checked={ack}
                    onChange={(e) => setAck(e.target.checked)}
                    required
                  />
                  I reviewed the source report, observations and recorded
                  consent. Recommendations are clinician-entered or approved.
                </label>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={back}
                >
                  Cancel
                </button>
                <button className="button primary">
                  <Save size={15} />
                  {status === "Reviewed"
                    ? "Save clinician review"
                    : "Save review notes"}
                </button>
              </div>
            </form>
          ) : (
            <div className="scan-read-only-review">
              <CheckCircle2 size={26} />
              <h3>Review status: {r.status}</h3>
              <p>
                {r.scan.observations ||
                  "No clinician observations recorded yet."}
              </p>
              <p>
                Choose the Doctor or Clinic Owner demo role to enter or approve
                a clinical review.
              </p>
              <button
                className="button secondary"
                onClick={() => navigate(reportUrl)}
              >
                View report
              </button>
            </div>
          )}
        </section>
        <aside className="scan-review-side">
          <section className="card">
            <SectionTitle title="Before recording a review" />
            <ul>
              <li>Confirm the patient and relevant capture area.</li>
              <li>Read the attached source report and original images.</li>
              <li>
                Record only clinician-entered observations and recommendations.
              </li>
              <li>Link the existing course when relevant.</li>
            </ul>
            <button className="text-button" onClick={() => navigate(reportUrl)}>
              Open full report
              <ArrowUpRight size={13} />
            </button>
            {courseId && (
              <button
                className="text-button"
                onClick={() => onCourse(courseId)}
              >
                View linked course
                <ArrowUpRight size={13} />
              </button>
            )}
          </section>
          <section className="card scan-review-history">
            <SectionTitle title="Review history" />
            {r.scan.reviewHistory.map((h) => (
              <article key={h.id}>
                <Badge>{h.status}</Badge>
                <strong>{h.doctor}</strong>
                <small>
                  {new Date(h.at).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}{" "}
                  IST
                </small>
                <p>{h.note || h.observations || "Review status recorded."}</p>
              </article>
            ))}
            {!r.scan.reviewHistory.length && (
              <p className="scan-small-empty">
                No review updates have been recorded in this workflow.
              </p>
            )}
          </section>
        </aside>
      </div>
      {cancel && (
        <Modal
          title="Discard unsaved review changes?"
          onClose={() => setCancel(false)}
        >
          <p>
            Your saved report will be retained. Discard the current unsaved
            observations and notes?
          </p>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => setCancel(false)}
            >
              Keep editing
            </button>
            <button
              className="button danger"
              onClick={() => navigate(reportUrl)}
            >
              Discard changes
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
