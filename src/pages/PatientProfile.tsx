import { PatientPackageBalances } from "../features/finance/Packages";
import { useState } from "react";
import {
  useParams,
  useSearchParams,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  ArrowLeft,
  CalendarPlus,
  Stethoscope,
  ScanFace,
  ClipboardPlus,
  Activity,
  Clock,
  Wallet,
  Phone,
  Mail,
  UserRound,
  ShieldCheck,
  AlertTriangle,
  Pencil,
  Archive,
  MapPin,
  ClipboardList,
} from "lucide-react";
import { useClinic, addActivity } from "../store";
import { Avatar, Badge, Modal, SectionTitle } from "../components";
import { DEMO_DATE, type RecordItem } from "../data";
import { type Role, canBook } from "../auth";
import {
  patientSummary,
  calculateAge,
  updatePatient,
} from "../patientServices";
import { dayLabel } from "../services";
import { quickActions, type CreateKind } from "../features/QuickCreate";
import PatientForm from "../features/patients/PatientForm";
import ClinicalEditor from "../features/patients/ClinicalEditor";
import {
  CourseCards,
  PatientRecordList,
  PatientAppointments,
  PatientFollowups,
  ScanComparison,
  PatientTimeline,
  ClinicalSummary,
  PatientFinanceSummary,
} from "../features/patients/PatientPanels";
import {
  PatientPhotos,
  PatientDocuments,
} from "../features/patients/PatientAssets";
export const profileTabs = [
  "Overview",
  "Clinical History",
  "Skin Analysis",
  "Treatment Courses",
  "Sessions",
  "Photos",
  "Appointments",
  "Consents & Documents",
  "Packages & Payments",
  "Activity",
];
export default function PatientProfile({
  role,
  onCreate,
  onCourse,
}: {
  role: Role;
  onCreate: (kind: CreateKind, patientId: string) => void;
  onCourse: (id: string) => void;
}) {
  const { patientId } = useParams();
  const { state, setState, notify } = useClinic();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const patient = state.patients.find((p) => p.id === patientId);
  const [editing, setEditing] = useState(false);
  const [clinicalEdit, setClinicalEdit] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [preview, setPreview] = useState<RecordItem | null>(null);
  const [courseFilter, setCourseFilter] = useState("All");
  const tab = profileTabs.includes(params.get("tab") || "")
    ? params.get("tab")!
    : "Overview";
  const canReview = role === "Clinic Owner" || role === "Doctor";
  const canManage = canBook(role);
  if (!patient)
    return (
      <section className="card patient-not-found">
        <UserRound size={30} />
        <h1>Patient record not found</h1>
        <p>This patient may no longer be available in this local demo.</p>
        <button
          className="button primary"
          onClick={() => navigate("/patients")}
        >
          Back to patients
        </button>
      </section>
    );
  const summary = patientSummary(state, patient);
  const related = (module: string) =>
    state.records[module]
      .filter((r) => r.patientId === patient.id)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const action = (kind: CreateKind) => onCreate(kind, patient.id);
  const actions = [
    {
      kind: "appointment" as const,
      label: "Book appointment",
      Icon: CalendarPlus,
    },
    {
      kind: "consultation" as const,
      label: "Start consultation",
      Icon: Stethoscope,
    },
    { kind: "scan" as const, label: "Add skin scan", Icon: ScanFace },
    {
      kind: "plan" as const,
      label: "Create treatment plan",
      Icon: ClipboardPlus,
    },
    { kind: "session" as const, label: "Record sitting", Icon: Activity },
    { kind: "followup" as const, label: "Schedule follow-up", Icon: Clock },
    { kind: "payment" as const, label: "Record payment", Icon: Wallet },
  ].filter(
    (a) =>
      patient.status !== "Archived" &&
      quickActions(role).some((q) => q.kind === a.kind),
  );
  const changeTab = (value: string) =>
    setParams({ tab: value }, { replace: true });
  const back = () => navigate("/patients" + (location.state?.directory || ""));
  const archive = () => {
    const status =
      patient.status === "Archived"
        ? patient.archivedFrom || "Active"
        : "Archived";
    setState((s) =>
      addActivity(
        updatePatient(s, {
          ...patient,
          status,
          archivedFrom:
            patient.status === "Archived" ? undefined : patient.status,
        }),
        `${patient.name}: patient ${status === "Archived" ? "archived" : "restored"}.`,
        patient.id,
      ),
    );
    notify(
      status === "Archived"
        ? "Patient archived; linked care records are retained"
        : "Patient restored",
    );
    setArchiving(false);
  };
  return (
    <div className="patient-360">
      <div className="patient-profile-breadcrumb">
        <button className="text-button" onClick={back}>
          <ArrowLeft size={14} />
          Patient directory
        </button>
        <span>/</span>
        <span>Patient 360</span>
        <span className="profile-demo-badge">FICTIONAL DEMO RECORD</span>
      </div>
      <section className="card patient-identity-card">
        <div className="patient-identity-main">
          <Avatar name={patient.name} />
          <div className="patient-name-block">
            <div>
              <h1>{patient.name}</h1>
              <Badge>{summary.status}</Badge>
            </div>
            <p>
              {patient.id}
              <span>·</span>
              {patient.dob ? calculateAge(patient.dob) : patient.age} years
              <span>·</span>
              {patient.gender || "Gender not recorded"}
            </p>
          </div>
          <div className="patient-profile-actions">
            {canManage && (
              <button
                className="button secondary"
                onClick={() => setEditing(true)}
              >
                <Pencil size={14} />
                Edit details
              </button>
            )}
            {canManage && (
              <button
                className="icon"
                title={
                  patient.status === "Archived"
                    ? "Restore patient"
                    : "Archive patient"
                }
                aria-label={
                  patient.status === "Archived"
                    ? "Restore patient"
                    : "Archive patient"
                }
                onClick={() => setArchiving(true)}
              >
                <Archive size={17} />
              </button>
            )}
          </div>
        </div>
        <div className="patient-contact-grid">
          <div>
            <Phone size={15} />
            <span>
              <small>Mobile</small>
              <strong>{patient.phone}</strong>
            </span>
          </div>
          <div>
            <Mail size={15} />
            <span>
              <small>Email</small>
              <strong>{patient.email || "Not recorded"}</strong>
            </span>
          </div>
          <div>
            <Stethoscope size={15} />
            <span>
              <small>Assigned doctor</small>
              <strong>{summary.doctor}</strong>
            </span>
          </div>
          <div>
            <ShieldCheck size={15} />
            <span>
              <small>Communication consent</small>
              <strong>
                {patient.consentStatus || "Pending"} ·{" "}
                {patient.communicationPreference || "Phone"}
              </strong>
            </span>
          </div>
        </div>
        {patient.clinical?.alerts.length ? (
          <div className="patient-alert">
            <AlertTriangle size={17} />
            <div>
              <strong>
                {patient.clinical.reviewedBy
                  ? "Important clinician-reviewed alert"
                  : "Alerts awaiting clinician review"}
              </strong>
              {patient.clinical.alerts.map((alert) => (
                <p key={alert}>{alert}</p>
              ))}
              <small>
                {patient.clinical.reviewedBy} · reviewed{" "}
                {dayLabel(patient.clinical.reviewedAt || DEMO_DATE)}
              </small>
            </div>
          </div>
        ) : (
          <div className="patient-alert patient-alert-neutral">
            <ShieldCheck size={15} />
            <span>
              {patient.clinical?.reviewedBy
                ? "No important alerts recorded at the last clinician review."
                : "Clinical review pending. Confirm history and allergies before treatment."}
            </span>
          </div>
        )}
      </section>
      <div
        className="patient-quick-actions"
        role="group"
        aria-label="Patient quick actions"
      >
        {actions.map((a) => (
          <button
            className="button secondary"
            key={a.kind}
            onClick={() => action(a.kind)}
          >
            <a.Icon size={15} />
            {a.label}
          </button>
        ))}
      </div>
      <div className="patient-sticky-context">
        <div>
          <strong>{patient.name}</strong>
          <span>{patient.id}</span>
          <small>
            {summary.active.length
              ? `${summary.active.length} active course${summary.active.length > 1 ? "s" : ""} · ${summary.active[0].detail.split(" · ")[0]}`
              : patient.treatment}
          </small>
        </div>
        <nav
          className="patient-profile-tabs"
          aria-label="Patient profile sections"
        >
          {profileTabs.map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              aria-current={tab === t ? "page" : undefined}
              onClick={() => changeTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>
      <div
        className="patient-tab-panel"
        role="region"
        aria-label={`${tab} content`}
      >
        {tab === "Overview" ? (
          <div className="patient-overview-grid">
            <div className="patient-overview-main">
              <section className="card overview-courses">
                <SectionTitle
                  title="Treatment journeys"
                  action="All courses"
                  onClick={() => changeTab("Treatment Courses")}
                />
                <CourseCards
                  patient={patient}
                  onCourse={onCourse}
                  onBook={
                    canBook(role) ? () => action("appointment") : undefined
                  }
                />
              </section>
              <section className="card">
                <SectionTitle
                  title="Recent sessions"
                  action="View all"
                  onClick={() => changeTab("Sessions")}
                />
                <PatientRecordList
                  rows={related("Sittings & Sessions").slice(0, 3)}
                  onOpen={(r) => navigate("/sittings-sessions/" + r.id)}
                  empty="No sessions recorded yet"
                />
              </section>
              <section className="card">
                <SectionTitle
                  title="Recent scan comparison"
                  action="Scan records"
                  onClick={() => changeTab("Skin Analysis")}
                />
                <ScanComparison patient={patient} />
              </section>
            </div>
            <aside className="patient-overview-side">
              <section className="card">
                <SectionTitle
                  title="Upcoming appointments"
                  action="All visits"
                  onClick={() => changeTab("Appointments")}
                />
                <PatientAppointments patient={patient} limit={3} />
              </section>
              <section className="card">
                <SectionTitle
                  title="Follow-up status"
                  action={canBook(role) ? "Schedule" : undefined}
                  onClick={() => action("followup")}
                />
                <PatientFollowups patient={patient} onOpen={setPreview} />
              </section>
              <section className="card">
                <SectionTitle
                  title="Patient activity"
                  action="Timeline"
                  onClick={() => changeTab("Activity")}
                />
                <PatientTimeline patient={patient} limit={4} />
              </section>
            </aside>
          </div>
        ) : tab === "Clinical History" ? (
          <div className="patient-clinical-layout">
            <ClinicalSummary
              patient={patient}
              onEdit={canReview ? () => setClinicalEdit(true) : undefined}
            />
            <section className="card">
              <SectionTitle
                title="Consultation history"
                action={canReview ? "Start consultation" : undefined}
                onClick={() => action("consultation")}
              />
              <PatientRecordList
                rows={related("Consultations")}
                onOpen={(r) => navigate("/consultations/" + r.id)}
                empty="No consultations recorded"
              />
            </section>
          </div>
        ) : tab === "Skin Analysis" ? (
          <div className="patient-tab-stack">
            <section className="card">
              <SectionTitle title="Simulated scan comparison" />
              <ScanComparison patient={patient} />
            </section>
            <section className="card">
              <SectionTitle
                title="Skin analysis records"
                action={canReview ? "Add scan" : undefined}
                onClick={() => action("scan")}
              />
              <div className="info-strip">
                <ShieldCheck size={15} />
                Simulated measurements only. No diagnosis or real device
                connection.
              </div>
              <PatientRecordList
                rows={related("Skin Analysis")}
                onOpen={(r) => navigate("/skin-analysis/" + r.id)}
                empty="No scan reports recorded"
              />
            </section>
          </div>
        ) : tab === "Treatment Courses" ? (
          <div className="patient-tab-stack">
            <section className="card profile-courses-tab">
              <SectionTitle
                title="Treatment courses"
                action={canReview ? "Create plan" : undefined}
                onClick={() => action("plan")}
              />
              <div className="patient-course-filter">
                {["All", "Active", "Completed"].map((s) => (
                  <button
                    className={courseFilter === s ? "active" : ""}
                    onClick={() => setCourseFilter(s)}
                    key={s}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <CourseCards
                patient={patient}
                filter={courseFilter}
                onCourse={onCourse}
                onBook={canBook(role) ? () => action("appointment") : undefined}
              />
            </section>
            <section className="card">
              <SectionTitle title="Treatment plan proposals" />
              <PatientRecordList
                rows={state.records["Plan Proposals"].filter(
                  (r) => r.patientId === patient.id,
                )}
                onOpen={(r) => navigate("/treatment-plans/" + r.id)}
                empty="No treatment plan proposals recorded"
              />
            </section>
          </div>
        ) : tab === "Sessions" ? (
          <section className="card">
            <SectionTitle
              title="Sittings & sessions"
              action={
                actions.some((a) => a.kind === "session")
                  ? "Record sitting"
                  : undefined
              }
              onClick={() => action("session")}
            />
            <PatientRecordList
              rows={related("Sittings & Sessions")}
              onOpen={(r) => navigate("/sittings-sessions/" + r.id)}
              empty="No sittings recorded"
            />
          </section>
        ) : tab === "Photos" ? (
          <PatientPhotos patient={patient} canEdit={canReview} />
        ) : tab === "Appointments" ? (
          <section className="card">
            <SectionTitle
              title="Appointment history & upcoming visits"
              action={canBook(role) ? "Book visit" : undefined}
              onClick={() => action("appointment")}
            />
            <PatientAppointments patient={patient} />
          </section>
        ) : tab === "Consents & Documents" ? (
          <PatientDocuments
            patient={patient}
            canEdit={canManage}
            onOpen={setPreview}
          />
        ) : tab === "Packages & Payments" ? (
          <div className="patient-tab-stack">
            <section className="card">
              <SectionTitle
                title="Packages & payments"
                action={
                  actions.some((a) => a.kind === "payment")
                    ? "Record payment"
                    : undefined
                }
                onClick={() => action("payment")}
              />
              <PatientFinanceSummary patient={patient} />
              <PatientPackageBalances patientId={patient.id} />
            </section>
            <div className="patient-financial-grid">
              <section className="card">
                <SectionTitle title="Packages & invoices" />
                <PatientRecordList
                  rows={related("Packages & Billing")}
                  onOpen={(r) => navigate("/invoices/" + r.id)}
                  empty="No packages or invoices"
                />
              </section>
              <section className="card">
                <SectionTitle title="Recorded payments" />
                <PatientRecordList
                  rows={related("Payments")}
                  onOpen={(r) => navigate("/payments?record=" + r.id)}
                  empty="No payments recorded"
                />
              </section>
            </div>
          </div>
        ) : (
          <section className="card">
            <SectionTitle title="Patient activity timeline" />
            <PatientTimeline patient={patient} />
          </section>
        )}
      </div>
      <section className="patient-contact-details">
        <div>
          <MapPin size={14} />
          <span>
            <strong>Address</strong>
            {patient.address || "Not recorded"}
          </span>
        </div>
        <div>
          <Phone size={14} />
          <span>
            <strong>Emergency contact</strong>
            {patient.emergencyContact || "Not recorded"}
          </span>
        </div>
        <div>
          <UserRound size={14} />
          <span>
            <strong>Referred through</strong>
            {patient.referralSource || "Not recorded"}
          </span>
        </div>
      </section>
      {editing && (
        <PatientForm
          patient={patient}
          onClose={() => setEditing(false)}
          onExisting={(p) => navigate("/patients/" + p.id)}
        />
      )}{" "}
      {clinicalEdit && (
        <ClinicalEditor
          patient={patient}
          onClose={() => setClinicalEdit(false)}
        />
      )}{" "}
      {archiving && (
        <Modal
          title={
            patient.status === "Archived"
              ? "Restore patient"
              : "Archive patient"
          }
          onClose={() => setArchiving(false)}
        >
          <p>
            {patient.status === "Archived"
              ? `Restore ${patient.name} to the patient directory?`
              : `Archive ${patient.name}? All appointments, clinical records and payments will be retained under ${patient.id}.`}
          </p>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => setArchiving(false)}
            >
              Cancel
            </button>
            <button
              className={`button ${patient.status === "Archived" ? "primary" : "danger"}`}
              onClick={archive}
            >
              {patient.status === "Archived"
                ? "Restore patient"
                : "Confirm archive"}
            </button>
          </div>
        </Modal>
      )}
      {preview && (
        <Modal
          title={
            preview.measurements ? "Simulated scan report" : "Patient record"
          }
          onClose={() => setPreview(null)}
        >
          <div className="patient-record-preview">
            <span className="round-symbol sage-bg">
              <ClipboardList size={20} />
            </span>
            <h3>{preview.detail.split(" · ")[0] || preview.name}</h3>
            <p>
              {patient.name} · {patient.id}
            </p>
            <Badge>{preview.status}</Badge>
            <p>{preview.detail}</p>
            {preview.amount > 0 && (
              <h2>
                {new Intl.NumberFormat("en-IN", {
                  style: "currency",
                  currency: "INR",
                  maximumFractionDigits: 0,
                }).format(preview.amount)}
              </h2>
            )}
            {preview.date && <small>Recorded {dayLabel(preview.date)}</small>}
            {preview.dueDate && <small>Due {dayLabel(preview.dueDate)}</small>}
            {preview.measurements && (
              <>
                <div className="scan-metrics">
                  {Object.entries(preview.measurements).map(([key, value]) => (
                    <div key={key}>
                      <small>{key}</small>
                      <strong>
                        {value}
                        <span>/100</span>
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="info-strip">
                  Simulated indices. Clinician review:{" "}
                  {preview.reviewedBy || "Pending"}. No AI diagnosis or real
                  device connectivity.
                </div>
              </>
            )}
            <button
              className="button secondary"
              onClick={() => setPreview(null)}
            >
              Close record
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
