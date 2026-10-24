import { clinicDoctors } from "../admin/access";
import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Plus, Search, ArrowUpRight } from "lucide-react";
import { Badge, Modal } from "../../components";
import { money } from "../../data";
import { doctors } from "../../patientServices";
import { canDecide, planStatuses, estimate } from "./model";
import { transitionPlan, convertPlan, courseBalance } from "./services";
import {
  ClinicalNotice,
  PatientContext,
  FormSection,
  useClinicalSave,
} from "./ClinicalComponents";
import PlanBuilder from "./PlanBuilder";
import type { Role } from "../../auth";
export default function TreatmentPlans({ role }: { role: Role }) {
  const { planId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { state, save, error, setError } = useClinicalSave();
  const [q, setQ] = useState(params.get("q") || "");
  const [status, setStatus] = useState(params.get("status") || "All");
  const [action, setAction] = useState("");
  const [doctor, setDoctor] = useState(doctors[0]);
  const [note, setNote] = useState("");
  const [ack, setAck] = useState(false);
  const [packageId, setPackageId] = useState("");
  const r = state.records["Plan Proposals"].find((r) => r.id === planId);
  const isNew = planId === "new",
    edit = params.get("edit") === "true";
  const goCourse = (id: string) => navigate("/treatment-plans/courses/" + id);
  useEffect(() => {
    const id = params.get("record");
    if (!planId && id) {
      const course = state.records["Treatment Plans"].find((c) => c.id === id);
      if (course) navigate("/treatment-plans/courses/" + id, { replace: true });
      else if (state.records["Plan Proposals"].some((p) => p.id === id))
        navigate("/treatment-plans/" + id, { replace: true });
    }
  }, [planId, params, state.records, navigate]);
  if (planId) {
    if (!isNew && !r)
      return (
        <section className="card empty">
          <h1>Plan not found</h1>
          <button
            className="button secondary"
            onClick={() => navigate("/treatment-plans")}
          >
            Treatment Plans
          </button>
        </section>
      );
    if (
      (isNew || edit) &&
      canDecide(role) &&
      (!r || ["Draft", "Declined"].includes(r.status))
    )
      return (
        <div>
          <div className="page-heading">
            <div>
              <div className="eyebrow">CLINICIAN-ENTERED PROPOSAL</div>
              <h1>{isNew ? "New treatment plan" : "Resume treatment plan"}</h1>
              <p>
                Build from an existing consultation. Review before converting to
                a course.
              </p>
            </div>
          </div>
          <ClinicalNotice />
          <PlanBuilder
            existing={r}
            key={r?.id || params.toString()}
            initialPatientId={params.get("patientId") || ""}
            initialConsultationId={params.get("consultationId") || ""}
            onClose={() =>
              navigate(r ? "/treatment-plans/" + r.id : "/treatment-plans")
            }
            onSaved={(r) => navigate("/treatment-plans/" + r.id)}
            onPatient={(id) => navigate("/patients/" + id)}
          />
        </div>
      );
    if (isNew)
      return (
        <section className="card empty">
          <h1>Choose a clinician demo role to create a plan.</h1>
        </section>
      );
    const p = r!.plan!,
      patient = state.patients.find((v) => v.id === r!.patientId),
      source = state.records.Consultations.find(
        (v) => v.id === p.consultationId,
      );
    return (
      <div>
        <button
          className="text-button"
          onClick={() => navigate("/treatment-plans")}
        >
          ← Treatment plans
        </button>
        <div className="page-heading">
          <div>
            <div className="eyebrow">TREATMENT PROPOSAL / {r!.id}</div>
            <h1>{p.treatmentName || "Treatment plan draft"}</h1>
            <p>
              {r!.name} · {p.area || "Area pending"} · {r!.date}
            </p>
          </div>
          <div className="heading-actions">
            <Badge>{r!.status}</Badge>
            {canDecide(role) && ["Draft", "Declined"].includes(r!.status) && (
              <button
                className="button primary"
                onClick={() => navigate("?edit=true")}
              >
                Resume Draft
              </button>
            )}
            {canDecide(role) && r!.status === "Awaiting Approval" && (
              <>
                <button
                  className="button secondary"
                  onClick={() => {
                    setAction("Declined");
                    setError("");
                    setAck(false);
                  }}
                >
                  Decline plan
                </button>
                <button
                  className="button primary"
                  onClick={() => {
                    setAction("Approved");
                    setError("");
                    setAck(false);
                  }}
                >
                  Approve plan
                </button>
              </>
            )}
            {canDecide(role) && r!.status === "Approved" && (
              <button
                className="button primary"
                onClick={() => setAction("convert")}
              >
                Convert to Course
              </button>
            )}
            {p.courseId && (
              <button
                className="button primary"
                onClick={() => goCourse(p.courseId!)}
              >
                Open course
              </button>
            )}
          </div>
        </div>
        <ClinicalNotice />
        <div className="clinical-workspace">
          <div className="clinical-primary">
            <FormSection title="Source assessment">
              <div className="clinical-assessment">
                <Badge>{source?.status || "Source not selected"}</Badge>
                <p>{p.assessment || "No source assessment recorded."}</p>
                {source && (
                  <button
                    className="text-button"
                    onClick={() => navigate("/consultations/" + source.id)}
                  >
                    Open source consultation
                    <ArrowUpRight size={13} />
                  </button>
                )}
              </div>
              {r!.status === "Awaiting Approval" &&
                source?.status !== "Reviewed" && (
                  <p className="clinical-pending">
                    The source consultation requires review before this proposal
                    can be approved.
                  </p>
                )}
            </FormSection>
            <FormSection title="Proposed course configuration">
              <dl className="clinical-detail-grid">
                {Object.entries({
                  Treatment: p.treatmentName,
                  Area: p.area,
                  Sessions: p.sessions,
                  Interval: p.intervalDays + " days",
                  "Session duration": p.duration + " minutes",
                  "Assigned doctor": p.doctor,
                  "Assigned technician": p.technician,
                  Validity: p.validityDays + " days",
                  Instructions: p.instructions || "Not recorded",
                  "Consent requirements": p.consent || "Not recorded",
                  "Clinician plan note": p.notes || "Not recorded",
                  "Approving doctor": p.approvedBy || "Approval pending",
                  "Decision note":
                    p.declineReason ||
                    p.approvalNote ||
                    "No decision note recorded",
                }).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </FormSection>
            <section className="card clinical-estimate">
              <div>
                <small>
                  PROPOSED TOTAL ·{" "}
                  {p.pricing === "package" ? "PACKAGE RATE" : "INDIVIDUAL RATE"}
                </small>
                <strong>
                  {Number.isFinite(estimate(p))
                    ? money(estimate(p))
                    : "Incomplete quote"}
                </strong>
              </div>
              <p>
                {p.pricing === "package"
                  ? `${money(p.packagePrice)} / ${p.packageSessions} reference sessions × ${p.sessions} sessions`
                  : `${money(p.individualPrice)} × ${p.sessions} sessions`}
                <small>
                  Payment is pending until an invoice is paid. Conversion
                  creates one course and one demo invoice.
                </small>
              </p>
            </section>
          </div>
          <PatientContext
            patient={patient}
            reactions={source?.consultation?.previousReactions}
            onPatient={(id) => navigate("/patients/" + id)}
          />
        </div>
        {action && (
          <Modal
            title={
              action === "convert"
                ? "Convert approved plan to course?"
                : action === "Approved"
                  ? "Approve treatment plan?"
                  : "Decline treatment plan?"
            }
            onClose={() => setAction("")}
          >
            <div className="clinical-form">
              {action === "convert" ? (
                <p>
                  Create one course for {r!.name} with {p.sessions} sessions and
                  a{" "}
                  {money(
                    packageId
                      ? state.records["Package Catalogue"].find(
                          (v) => v.id === packageId,
                        )?.amount || 0
                      : estimate(p),
                  )}{" "}
                  demo invoice. No payment is collected automatically. Repeated
                  conversion cannot create another course.
                </p>
              ) : (
                <>
                  <label>
                    Reviewing doctor
                    <select
                      aria-label="Approving doctor"
                      value={doctor}
                      onChange={(e) => setDoctor(e.target.value)}
                    >
                      {clinicDoctors(state).map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {action === "Declined"
                      ? "Reason for declining"
                      : "Approval note (optional)"}
                    <textarea
                      aria-label="Approval decision note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                  {action === "Approved" && (
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={ack}
                        onChange={(e) => setAck(e.target.checked)}
                      />
                      I approve these patient-specific sessions, intervals,
                      pricing and consent requirements.
                    </label>
                  )}
                </>
              )}
              {action === "convert" && (
                <label>
                  Package for course conversion
                  <select
                    aria-label="Conversion package"
                    value={packageId}
                    onChange={(e) => setPackageId(e.target.value)}
                  >
                    <option value="">
                      Approved plan estimate ? {money(estimate(p))}
                    </option>
                    {state.records["Package Catalogue"]
                      .filter(
                        (v) =>
                          v.status === "Active" &&
                          v.packageConfig?.treatmentId === p.treatmentId &&
                          v.packageConfig.sessions === p.sessions &&
                          [p.area, "Any clinician-approved area"].includes(
                            v.packageConfig.area,
                          ),
                      )
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ? {money(v.amount)} ?{" "}
                          {v.packageConfig?.validityDays} days
                        </option>
                      ))}
                  </select>
                  <small>
                    The offer must match the clinician-approved treatment, area
                    and session count. The selected price and validity are
                    retained with this purchase.
                  </small>
                </label>
              )}
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
                  Cancel
                </button>
                <button
                  className={
                    "button " + (action === "Declined" ? "danger" : "primary")
                  }
                  onClick={() => {
                    try {
                      if (action === "Approved" && !ack)
                        throw new Error("Confirm clinician approval first.");
                      const next =
                        action === "convert"
                          ? convertPlan(state, r!.id, packageId || undefined)
                          : transitionPlan(
                              state,
                              r!.id,
                              action as "Approved" | "Declined",
                              doctor,
                              note,
                            );
                      if (
                        save(
                          next,
                          action === "convert"
                            ? "Approved plan converted to one course"
                            : "Treatment plan " + action.toLowerCase(),
                          r!.patientId,
                        )
                      ) {
                        setAction("");
                        if (action === "convert")
                          goCourse(
                            next.records["Treatment Plans"].find(
                              (c) => c.course?.planId === r!.id,
                            )!.id,
                          );
                      }
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                >
                  {action === "convert"
                    ? "Create course"
                    : action === "Approved"
                      ? "Confirm approval"
                      : "Confirm decline"}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  }
  const courses =
    params.get("view") === "courses" ||
    ["Active", "Paused", "Cancelled", "Completed"].includes(
      params.get("status") || "",
    );
  const rows = (
    courses ? state.records["Treatment Plans"] : state.records["Plan Proposals"]
  ).filter(
    (r) =>
      (r.name + " " + r.id + " " + r.detail)
        .toLowerCase()
        .includes(q.toLowerCase()) &&
      (status === "All" || r.status === status),
  );
  return (
    <div>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CONNECTED TREATMENT JOURNEYS</div>
          <h1>Treatment Plans</h1>
          <p>Considered proposals. Clear approvals. Connected courses.</p>
        </div>
        {canDecide(role) && (
          <button
            className="button primary"
            onClick={() => navigate("/treatment-plans/new")}
          >
            <Plus size={15} />
            New treatment plan
          </button>
        )}
      </div>
      <ClinicalNotice />
      <div
        className="clinical-tabs"
        role="tablist"
        aria-label="Plans and courses"
      >
        <button
          role="tab"
          aria-selected={!courses}
          onClick={() => {
            setParams({ view: "plans" });
            setStatus("All");
          }}
        >
          Plans <span>{state.records["Plan Proposals"].length}</span>
        </button>
        <button
          role="tab"
          aria-selected={courses}
          onClick={() => {
            setParams({ view: "courses" });
            setStatus("All");
          }}
        >
          Courses <span>{state.records["Treatment Plans"].length}</span>
        </button>
      </div>
      <div className="card clinical-toolbar">
        <div className="search-field">
          <Search size={15} />
          <input
            aria-label="Search treatment plans"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Patient, treatment or record ID…"
          />
        </div>
        <label>
          Status
          <select
            aria-label="Plan status filter"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {[
              "All",
              ...(courses
                ? ["Active", "Paused", "Cancelled", "Completed"]
                : planStatuses),
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <button
          className="text-button"
          onClick={() => {
            setQ("");
            setStatus("All");
          }}
        >
          Reset
        </button>
      </div>
      <div className="card clinical-record-list">
        {rows.map((r) => (
          <article key={r.id}>
            <button
              className="clinical-list-patient"
              onClick={() => navigate("/patients/" + r.patientId)}
            >
              <strong>{r.name}</strong>
              <small>{r.patientId}</small>
            </button>
            <div>
              <strong>
                {r.plan?.treatmentName || r.course?.treatmentName || r.detail}
              </strong>
              <small>
                {r.plan?.area || r.course?.area} · {r.id}
              </small>
              {courses && (
                <small>
                  {r.completedSittings || 0}/{r.totalSittings || 0} sessions ·{" "}
                  {money(courseBalance(state, r))} outstanding
                </small>
              )}
            </div>
            <span>
              <strong>
                {money(r.plan ? estimate(r.plan) : r.course?.packagePrice || 0)}
              </strong>
              <small>{courses ? "Course quote" : "Proposed estimate"}</small>
            </span>
            <Badge>{r.status}</Badge>
            <button
              className="button secondary"
              onClick={() =>
                courses ? goCourse(r.id) : navigate("/treatment-plans/" + r.id)
              }
            >
              {courses ? "Open course" : "Open plan"}
              <ArrowUpRight size={13} />
            </button>
          </article>
        ))}
        {!rows.length && (
          <div className="empty">
            <h3>No {courses ? "courses" : "plans"} in this view</h3>
            <p>
              {courses
                ? "An approved plan becomes a course when explicitly converted."
                : "Create a plan from a consultation or adjust your filters."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
