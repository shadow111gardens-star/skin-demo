import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CalendarDays,
  ArrowUpRight,
  Pause,
  Play,
  CheckCircle2,
} from "lucide-react";
import { Badge, Modal } from "../../components";
import { money, DEMO_DATE, type RecordItem } from "../../data";
import { canBill, type Role } from "../../auth";
import { recordPayment } from "../../services";
import { clinicDoctors } from "../admin/access";
import { canDecide } from "./model";
import { changeCourseStatus, courseBalance, upsert } from "./services";
import {
  ClinicalNotice,
  FormSection,
  PatientContext,
  useClinicalSave,
} from "./ClinicalComponents";
import type { CreateKind } from "../QuickCreate";
export default function CourseDetail({
  role,
  onCreate,
}: {
  role: Role;
  onCreate: (kind: CreateKind, patientId?: string, courseId?: string) => void;
}) {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { state, save, error, setError } = useClinicalSave();
  const r = state.records["Treatment Plans"].find((r) => r.id === courseId);
  const [action, setAction] = useState("");
  const [note, setNote] = useState("");
  const [doctor, setDoctor] = useState(clinicDoctors(state)[0] || "");
  const [selected, setSelected] = useState<RecordItem | null>(null);
  if (!r?.course)
    return (
      <section className="card empty">
        <h1>Course not found</h1>
        <button
          className="button secondary"
          onClick={() => navigate("/treatment-plans?view=courses")}
        >
          Course library
        </button>
      </section>
    );
  const c = r.course,
    patient = state.patients.find((p) => p.id === r.patientId),
    consult = state.records.Consultations.find(
      (v) => v.id === c.consultationId,
    ),
    invoice = state.records["Packages & Billing"].find(
      (v) => v.id === c.invoiceId,
    );
  const completed = r.completedSittings || 0,
    total = r.totalSittings || 0,
    remaining = Math.max(0, total - completed),
    balance = courseBalance(state, r);
  const sessions = state.records["Sittings & Sessions"].filter(
    (v) => v.courseId === r.id,
  );
  const visits = state.appointments.filter((a) => a.courseId === r.id);
  const followups = state.records["Follow-ups"].filter(
    (f) => f.courseId === r.id,
  );
  const paymentStatus = invoice
    ? balance === 0
      ? "Paid"
      : "Payment pending"
    : "No linked invoice";
  const timeline = [
    {
      label: "Consultation",
      detail: consult?.status || "Not linked",
      complete: consult?.status === "Reviewed",
      onClick: () => consult && navigate("/consultations/" + consult.id),
      disabled: !consult,
    },
    {
      label: "Plan Approved",
      detail: c.approvingDoctor,
      complete: true,
      onClick: () => navigate("/treatment-plans/" + c.planId),
    },
    {
      label: "Package Purchased",
      detail: paymentStatus,
      complete: !!invoice && balance === 0,
      onClick: () => (invoice ? setSelected(invoice) : setAction("invoice")),
    },
    {
      label: "Sessions",
      detail: completed + " / " + total + " completed",
      complete: remaining === 0,
      onClick: () => setAction("sessions"),
    },
    {
      label: "Follow-up",
      detail: followups.length + " linked records",
      complete: followups.some((v) => v.status === "Completed"),
      onClick: () => setAction("followup"),
    },
    {
      label: "Final Review",
      detail: c.finalReview ? "Review recorded" : "Review pending",
      complete: !!c.finalReview,
      onClick: () => open("final"),
    },
  ];
  function open(action: string) {
    setAction(action);
    setNote("");
    setError("");
  }
  function transition() {
    try {
      if (
        save(
          changeCourseStatus(state, r!.id, action, note),
          "Course " + action.toLowerCase(),
          r!.patientId,
        )
      )
        setAction("");
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <div className="clinical-course-page">
      <button
        className="text-button"
        onClick={() => navigate("/treatment-plans?view=courses")}
      >
        ← All treatment courses
      </button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">TREATMENT COURSE / {r.id}</div>
          <h1>{c.treatmentName}</h1>
          <p>
            {r.name} · {c.area} · started {c.startDate}
          </p>
        </div>
        <div className="heading-actions">
          <Badge>{r.status}</Badge>
          {canDecide(role) && r.status === "Active" && (
            <button className="button secondary" onClick={() => open("Paused")}>
              <Pause size={13} />
              Pause
            </button>
          )}
          {canDecide(role) && r.status === "Paused" && (
            <button className="button primary" onClick={() => open("Active")}>
              <Play size={13} />
              Resume
            </button>
          )}
          {canDecide(role) && ["Active", "Paused"].includes(r.status) && (
            <button
              className="button secondary"
              onClick={() => open("Cancelled")}
            >
              Cancel course
            </button>
          )}
          {canDecide(role) &&
            (r.status === "Active" ||
              (r.status === "Completed" && !c.completionConfirmed)) && (
              <button
                className="button secondary"
                onClick={() => open("Completed")}
              >
                <CheckCircle2 size={14} />
                {r.status === "Completed"
                  ? "Confirm course completion"
                  : "Complete course"}
              </button>
            )}
        </div>
      </div>
      <ClinicalNotice />
      <nav className="clinical-course-timeline" aria-label="Treatment journey">
        {timeline.map((t, i) => (
          <button
            key={t.label}
            disabled={t.disabled}
            className={t.complete ? "complete" : ""}
            onClick={t.onClick}
          >
            <span>{t.complete ? <CheckCircle2 size={17} /> : i + 1}</span>
            <strong>{t.label}</strong>
            <small>{t.detail}</small>
          </button>
        ))}
      </nav>
      <div className="clinical-course-metrics">
        {[
          ["Planned sessions", total],
          ["Completed sessions", completed],
          ["Remaining sessions", remaining],
          ["Outstanding payment", money(balance)],
        ].map(([k, v]) => (
          <div className="card" key={k}>
            <small>{k}</small>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <div className="clinical-workspace">
        <div className="clinical-primary">
          <FormSection title="Course configuration">
            <div className="clinical-course-progress">
              <span>
                {completed} of {total} planned sessions completed
              </span>
              <progress max={total || 1} value={completed} />
            </div>
            <dl className="clinical-detail-grid">
              {Object.entries({
                "Course ID": r.id,
                Patient: r.name + " | " + r.patientId,
                Treatment: c.treatmentName,
                Area: c.area,
                "Approving doctor": c.approvingDoctor,
                "Assigned doctor":
                  c.assignedDoctor || r.doctor || "Not assigned",
                "Assigned technician": c.technician,
                "Start date": c.startDate,
                "Next recommended date":
                  remaining && r.status !== "Cancelled"
                    ? c.nextRecommendedDate || "Not scheduled"
                    : "No further session recommended",
                "Recommended interval": c.intervalDays + " days",
                Validity:
                  c.validUntil + (c.validUntil < DEMO_DATE ? " (expired)" : ""),
                "Package / course price": money(c.packagePrice),
                "Payment status": paymentStatus,
                "Course closure":
                  r.status === "Completed"
                    ? c.completionConfirmed
                      ? "Completion confirmed"
                      : "Sessions complete; clinician confirmation pending"
                    : "Course in progress",
                "Remaining treatment value": money(
                  total ? Math.round((c.packagePrice / total) * remaining) : 0,
                ),
                "Clinician instructions": c.instructions || "Not recorded",
                "Consent requirements": c.consent,
                "Latest status note":
                  c.statusNote || "No status change recorded",
              }).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <p className="clinical-footnote">
              Recommended dates are configurable clinical scheduling guidance,
              not booked appointments. Outstanding payment is derived from
              linked invoices; unused treatment value decreases only when a
              sitting is completed.
            </p>
            <div className="form-actions">
              {r.status === "Active" && (
                <button
                  className="button primary"
                  onClick={() => onCreate("appointment", r.patientId, r.id)}
                >
                  <CalendarDays size={14} />
                  Book next sitting
                </button>
              )}
              {canBill(role) && invoice && balance > 0 && (
                <button
                  className="button secondary"
                  onClick={() => open("payment")}
                >
                  Record demo payment
                </button>
              )}
            </div>
          </FormSection>
          <FormSection title="Sessions & appointments">
            {visits.map((a) => (
              <button
                className="clinical-course-record"
                key={a.id}
                onClick={() =>
                  navigate(
                    "/appointments?record=" +
                      a.id +
                      "&q=" +
                      encodeURIComponent(patient?.name || r.name),
                  )
                }
              >
                <span>
                  <strong>
                    {a.date} · {a.time} · Sitting {a.sitting || "unassigned"}
                  </strong>
                  <small>
                    {a.doctor} · {a.technician} · {a.room}
                  </small>
                </span>
                <Badge>{a.status}</Badge>
                <ArrowUpRight size={14} />
              </button>
            ))}
            {sessions.map((s) => (
              <button
                className="clinical-course-record"
                key={s.id}
                onClick={() => setSelected(s)}
              >
                <span>
                  <strong>{s.detail}</strong>
                  <small>
                    {s.date} · {s.id}
                  </small>
                </span>
                <Badge>{s.status}</Badge>
              </button>
            ))}
            {!visits.length && !sessions.length && (
              <div className="clinical-empty">
                No sittings are booked yet. This course has {total} unused
                sessions.
              </div>
            )}
            <p className="clinical-footnote">
              Cancelled and rescheduled appointments do not consume a sitting.
              Completed sessions update this same course once.
            </p>
          </FormSection>
        </div>
        <PatientContext
          patient={patient}
          reactions={consult?.consultation?.previousReactions}
          onPatient={(id) => navigate("/patients/" + id)}
        />
      </div>
      {["Active", "Paused", "Cancelled", "Completed"].includes(action) && (
        <Modal
          title={
            action === "Cancelled"
              ? "Cancel this treatment course?"
              : action === "Active"
                ? "Resume this course?"
                : action === "Completed"
                  ? "Complete this course?"
                  : "Pause this course?"
          }
          onClose={() => setAction("")}
        >
          <div className="clinical-form">
            <p>
              {action === "Cancelled"
                ? "Uncompleted appointments and session records linked to this course will be cancelled without consuming sessions. Completed care and invoices remain retained. No refund is created automatically."
                : action === "Completed"
                  ? "All planned sessions must be completed. Financial outstandings and final review remain visible separately."
                  : "The course history and remaining sessions will be preserved. Paused courses cannot start or complete a sitting."}
            </p>
            <label>
              Clinician reason
              <textarea
                aria-label="Course status reason"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button
                className="button secondary"
                onClick={() => setAction("")}
              >
                Keep course
              </button>
              <button
                className={
                  "button " + (action === "Cancelled" ? "danger" : "primary")
                }
                onClick={transition}
              >
                Confirm{" "}
                {action === "Active"
                  ? "resume"
                  : action === "Paused"
                    ? "pause"
                    : action === "Completed"
                      ? "completion"
                      : "cancellation"}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {action === "payment" && invoice && (
        <Modal title="Record course demo payment" onClose={() => setAction("")}>
          <p>
            {invoice.id} · {money(balance)} outstanding. This records a
            fictional full payment; no money is transferred.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button className="button secondary" onClick={() => setAction("")}>
              Cancel
            </button>
            <button
              className="button primary"
              onClick={() => {
                if (
                  save(
                    recordPayment(
                      state,
                      r.patientId!,
                      balance,
                      DEMO_DATE,
                      invoice.id,
                    ),
                    "Course demo payment recorded",
                    r.patientId,
                  )
                )
                  setAction("");
              }}
            >
              Record {money(balance)} demo payment
            </button>
          </div>
        </Modal>
      )}
      {action === "sessions" && (
        <Modal title="Course session records" onClose={() => setAction("")}>
          <p>
            {completed} completed · {remaining} remaining
          </p>
          {sessions.map((s) => (
            <button
              className="clinical-course-record"
              key={s.id}
              onClick={() => setSelected(s)}
            >
              <span>
                <strong>{s.detail}</strong>
                <small>{s.id}</small>
              </span>
              <Badge>{s.status}</Badge>
            </button>
          ))}
          {!sessions.length && (
            <p className="clinical-empty">
              No session records yet. Book the first sitting from this course.
            </p>
          )}
        </Modal>
      )}
      {action === "followup" && (
        <Modal title="Course follow-ups" onClose={() => setAction("")}>
          {followups.map((f) => (
            <button
              className="clinical-course-record"
              key={f.id}
              onClick={() => setSelected(f)}
            >
              <span>
                <strong>{f.detail}</strong>
                <small>{f.dueDate}</small>
              </span>
              <Badge>{f.status}</Badge>
            </button>
          ))}
          {!followups.length && (
            <p className="clinical-empty">
              No course follow-up has been scheduled yet.
            </p>
          )}
          {canDecide(role) && (
            <button
              className="button primary"
              onClick={() => {
                setAction("");
                onCreate("followup", r.patientId, r.id);
              }}
            >
              Schedule follow-up
            </button>
          )}
        </Modal>
      )}
      {action === "final" && (
        <Modal title="Final clinician review" onClose={() => setAction("")}>
          <div className="clinical-form">
            {c.finalReview && (
              <div className="clinical-assessment">
                <Badge>Review recorded</Badge>
                <p>{c.finalReview}</p>
                <small>
                  {c.finalReviewDoctor} · {c.finalReviewAt}
                </small>
              </div>
            )}
            {remaining > 0 && (
              <p className="clinical-pending">
                Complete all planned sessions before recording the final course
                review.
              </p>
            )}
            {canDecide(role) && !remaining && !c.finalReview && (
              <>
                <label>
                  Reviewing doctor
                  <select
                    aria-label="Final reviewing doctor"
                    value={doctor}
                    onChange={(e) => setDoctor(e.target.value)}
                  >
                    {clinicDoctors(state).map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Final review note
                  <textarea
                    aria-label="Final review note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <button
                  className="button primary"
                  onClick={() => {
                    if (!note.trim()) {
                      setError("Enter a clinician final review note.");
                      return;
                    }
                    if (
                      save(
                        upsert(state, "Treatment Plans", {
                          ...r,
                          course: {
                            ...c,
                            finalReview: note.trim(),
                            finalReviewDoctor: doctor,
                            finalReviewAt: DEMO_DATE,
                          },
                        }),
                        "Final clinician review saved",
                        r.patientId,
                      )
                    )
                      setAction("");
                  }}
                >
                  Save Final Review
                </button>
              </>
            )}
            {!canDecide(role) && !c.finalReview && (
              <p>Final clinician review is pending.</p>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </Modal>
      )}
      {action === "invoice" && (
        <Modal title="Package record" onClose={() => setAction("")}>
          <p>
            No invoice was linked to this historical demonstration course.
            Existing financial records are retained.
          </p>
          <button
            className="button secondary"
            onClick={() =>
              navigate("/packages-billing?q=" + encodeURIComponent(r.name))
            }
          >
            Open patient billing
          </button>
        </Modal>
      )}
      {selected && (
        <Modal title="Related course record" onClose={() => setSelected(null)}>
          <div className="clinical-related-record">
            <Badge>{selected.status}</Badge>
            <h3>{selected.detail}</h3>
            <p>
              {selected.id} · {selected.date}
            </p>
            {selected.amount > 0 && <strong>{money(selected.amount)}</strong>}
            <p>
              {selected.patientId === r.patientId
                ? "Linked to the same patient record."
                : "Historical demonstration record."}
            </p>
            <button
              className="button secondary"
              onClick={() =>
                navigate(
                  "/" +
                    (selected.id === invoice?.id
                      ? "packages-billing"
                      : followups.some((f) => f.id === selected.id)
                        ? "follow-ups"
                        : "sittings-sessions") +
                    "?record=" +
                    selected.id,
                )
              }
            >
              Open in module
              <ArrowUpRight size={13} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
