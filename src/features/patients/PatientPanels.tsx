import {
  ArrowUpRight,
  CalendarDays,
  Clock,
  ClipboardList,
  ScanFace,
  Activity,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge, SectionTitle } from "../../components";
import { type Patient, type RecordItem, money, DEMO_DATE } from "../../data";
import { useClinic } from "../../store";
import { dayLabel, followupStatus } from "../../services";
import { patientSummary } from "../../patientServices";
export function EmptyPanel({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="patient-empty">
      <ClipboardList size={24} />
      <strong>{title}</strong>
      {description && <p>{description}</p>}
    </div>
  );
}
export function CourseCards({
  patient,
  onCourse,
  onBook,
  filter = "All",
}: {
  patient: Patient;
  onCourse: (id: string) => void;
  onBook?: () => void;
  filter?: string;
}) {
  const { state } = useClinic();
  const courses = state.records["Treatment Plans"].filter(
    (r) =>
      r.patientId === patient.id && (filter === "All" || r.status === filter),
  );
  return (
    <div className="patient-course-list">
      {courses.map((c) => {
        const total = c.totalSittings || 6,
          completed = Math.min(total, c.completedSittings || 0);
        const next = state.appointments
          .filter(
            (a) =>
              a.courseId === c.id &&
              a.date >= DEMO_DATE &&
              !["Completed", "Cancelled"].includes(a.status),
          )
          .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
        const balance = state.records["Packages & Billing"]
          .filter(
            (r) =>
              r.patientId === patient.id &&
              r.status !== "Paid" &&
              (r.courseId === c.id ||
                (!r.courseId &&
                  c.status === "Active" &&
                  state.records["Treatment Plans"].filter(
                    (plan) =>
                      plan.patientId === patient.id && plan.status === "Active",
                  ).length === 1)),
          )
          .reduce((n, r) => n + r.amount, 0);
        return (
          <article className="patient-course-card" key={c.id}>
            <div className="course-card-heading">
              <span className="round-symbol sage-bg">
                <ClipboardList size={18} />
              </span>
              <div>
                <h3>{c.detail.split(" · ")[0]}</h3>
                <small>{c.id}</small>
              </div>
              <Badge>{c.status}</Badge>
            </div>
            <div className="course-progress-label">
              <strong>
                {completed} of {total} sittings complete
              </strong>
              <span>{Math.max(0, total - completed)} remaining</span>
            </div>
            <progress
              aria-label={`${c.detail.split(" · ")[0]} progress`}
              max={total}
              value={completed}
            />
            <div className="course-card-data">
              <div>
                <small>Next sitting</small>
                <strong>
                  {next
                    ? `${dayLabel(next.date)} · ${next.time}`
                    : c.status === "Completed"
                      ? "Course completed"
                      : "Not scheduled"}
                </strong>
              </div>
              <div>
                <small>Outstanding</small>
                <strong className={balance ? "amount-due" : ""}>
                  {money(balance)}
                </strong>
              </div>
            </div>
            <div className="course-card-footer">
              <button className="text-button" onClick={() => onCourse(c.id)}>
                View course <ArrowUpRight size={13} />
              </button>
              {onBook && c.status === "Active" && (
                <button className="text-button" onClick={onBook}>
                  Book sitting <CalendarDays size={13} />
                </button>
              )}
            </div>
          </article>
        );
      })}
      {!courses.length && (
        <EmptyPanel
          title="No treatment courses yet"
          description="Create a clinician-reviewed plan to begin a connected course."
        />
      )}
    </div>
  );
}
export function PatientRecordList({
  rows,
  onOpen,
  empty = "No records yet",
}: {
  rows: RecordItem[];
  onOpen: (r: RecordItem) => void;
  empty?: string;
}) {
  return (
    <div className="patient-record-list">
      {rows.map((r) => (
        <button
          className="patient-record-item"
          key={r.id}
          onClick={() => onOpen(r)}
        >
          <span className="round-symbol sage-bg">
            <FileText size={17} />
          </span>
          <span>
            <strong>{r.detail.split(" · ")[0] || r.name}</strong>
            <small>
              {r.date
                ? dayLabel(r.date)
                : r.dueDate
                  ? `Due ${dayLabel(r.dueDate)}`
                  : r.name}
            </small>
            <small>{r.detail}</small>
          </span>
          {r.amount > 0 && (
            <strong className="patient-record-amount">{money(r.amount)}</strong>
          )}
          <Badge>{r.status}</Badge>
          <ArrowUpRight size={13} />
        </button>
      ))}
      {!rows.length && (
        <EmptyPanel
          title={empty}
          description="New linked records will appear here automatically."
        />
      )}
    </div>
  );
}
export function PatientAppointments({
  patient,
  limit,
}: {
  patient: Patient;
  limit?: number;
}) {
  const { state } = useClinic();
  const navigate = useNavigate();
  const all = state.appointments
    .filter((a) => a.patientId === patient.id)
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const rows = limit
    ? all
        .filter(
          (a) =>
            a.date >= DEMO_DATE &&
            !["Completed", "Cancelled"].includes(a.status),
        )
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
        .slice(0, limit)
    : all;
  return (
    <div className="patient-record-list">
      {rows.map((a) => (
        <button
          className="patient-visit-item"
          key={a.id}
          onClick={() =>
            navigate(`/appointments?date=${a.date}&patientId=${patient.id}`)
          }
        >
          <span className="round-symbol sage-bg">
            <CalendarDays size={17} />
          </span>
          <span>
            <strong>{a.treatment}</strong>
            <small>
              {dayLabel(a.date)} · {a.time} IST
            </small>
            <small>
              {a.doctor} · {a.room || "Room not assigned"}
            </small>
          </span>
          <Badge>{a.status}</Badge>
          <ArrowUpRight size={13} />
        </button>
      ))}
      {!rows.length && (
        <EmptyPanel
          title="No upcoming appointments"
          description="Book a visit to plan the next step in care."
        />
      )}
    </div>
  );
}
export function PatientFollowups({
  patient,
  onOpen,
}: {
  patient: Patient;
  onOpen: (r: RecordItem) => void;
}) {
  const { state } = useClinic();
  const rows = state.records["Follow-ups"]
    .filter((r) => r.patientId === patient.id)
    .map((r) => ({ ...r, status: followupStatus(r, DEMO_DATE) }));
  return (
    <div>
      {rows.map((r) => (
        <button
          className="patient-followup"
          key={r.id}
          onClick={() => onOpen(r)}
        >
          <span
            className={`round-symbol ${r.status === "Overdue" ? "rose-bg" : "amber-bg"}`}
          >
            <Clock size={17} />
          </span>
          <span>
            <strong>{r.detail.split(" · ")[0]}</strong>
            <small>
              {r.dueDate ? `Due ${dayLabel(r.dueDate)}` : "Date not recorded"}
            </small>
          </span>
          <Badge>{r.status}</Badge>
        </button>
      ))}
      {!rows.length && (
        <EmptyPanel
          title="No follow-ups scheduled"
          description="A thoughtful check-in can be scheduled from quick actions."
        />
      )}
    </div>
  );
}
export function ScanComparison({ patient }: { patient: Patient }) {
  const { state } = useClinic();
  const navigate = useNavigate();
  const scans = state.records["Skin Analysis"]
    .filter((r) => r.patientId === patient.id)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const latest = scans[0];
  if (!latest)
    return (
      <EmptyPanel
        title="No scan records yet"
        description="Add a fictional report to begin clinician review."
      />
    );
  return (
    <div className="patient-scan-comparison">
      <div className="comparison-dates">
        <span>
          <ScanFace size={16} />
          {latest.date ? dayLabel(latest.date) : "Latest scan"}
        </span>
        <Badge>{latest.status}</Badge>
      </div>
      <p>
        Source reports and clinician-entered observations. All measures are
        demonstration data.
      </p>
      <div className="form-actions">
        <button
          className="button secondary"
          onClick={() => navigate("/skin-analysis/" + latest.id)}
        >
          Open latest report
        </button>
        <button
          className="button secondary"
          onClick={() =>
            navigate("/skin-analysis/compare?patientId=" + patient.id)
          }
        >
          Compare scans
        </button>
      </div>
    </div>
  );
}
export function PatientTimeline({
  patient,
  limit,
}: {
  patient: Patient;
  limit?: number;
}) {
  const { state } = useClinic();
  const entries = state.activity
    .filter((a) => a.patientId === patient.id)
    .slice(0, limit || 100);
  return (
    <div className="patient-timeline">
      {entries.map((a) => (
        <div className="patient-timeline-entry" key={a.id}>
          <span className="timeline-symbol">
            <Activity size={13} />
          </span>
          <div>
            <p>{a.message}</p>
            <small>
              {new Intl.DateTimeFormat("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Kolkata",
              }).format(new Date(a.at))}{" "}
              IST
            </small>
          </div>
        </div>
      ))}
      <div className="patient-timeline-entry">
        <span className="timeline-symbol">
          <UsersIcon />
        </span>
        <div>
          <p>Patient record registered · {patient.id}</p>
          <small>
            {patient.registeredAt
              ? dayLabel(patient.registeredAt)
              : "Registration date not recorded"}
          </small>
        </div>
      </div>
    </div>
  );
}
function UsersIcon() {
  return <ClipboardList size={13} />;
}
export function ClinicalSummary({
  patient,
  onEdit,
}: {
  patient: Patient;
  onEdit?: () => void;
}) {
  return (
    <section className="card patient-clinical-summary">
      <SectionTitle
        title="Clinician-reviewed history"
        action={onEdit ? "Edit clinical history" : undefined}
        onClick={onEdit}
      />
      <div className="clinical-review-label">
        <ShieldCheck size={14} />
        {patient.clinical?.reviewedBy
          ? `Reviewed by ${patient.clinical.reviewedBy} · ${dayLabel(patient.clinical.reviewedAt || DEMO_DATE)}`
          : "Clinical history has not been reviewed yet."}
      </div>
      <div className="clinical-fields">
        {[
          ["Medical history", patient.clinical?.history],
          ["Allergies", patient.clinical?.allergies],
          ["Current medications", patient.clinical?.medications],
          ["Previous procedures", patient.clinical?.procedures],
        ].map(([label, value]) => (
          <div key={label}>
            <h3>{label}</h3>
            <p>
              {value || "Not recorded. Confirm with the treating clinician."}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
export function PatientFinanceSummary({ patient }: { patient: Patient }) {
  const { state } = useClinic();
  const summary = patientSummary(state, patient);
  const paid = state.records["Payments"]
    .filter((r) => r.patientId === patient.id && r.payment)
    .reduce(
      (n, r) => n + (r.payment?.kind === "Refund" ? -r.amount : r.amount),
      0,
    );
  return (
    <div className="patient-finance-summary">
      <div>
        <small>Net collected to date</small>
        <strong>{money(paid)}</strong>
      </div>
      <div>
        <small>Outstanding balance</small>
        <strong className={summary.outstanding ? "amount-due" : ""}>
          {money(summary.outstanding)}
        </strong>
      </div>
      <p>Demo financial records · no live transactions</p>
    </div>
  );
}
