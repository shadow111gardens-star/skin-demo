import { useState } from "react";
import { AlertTriangle, ShieldCheck, ArrowUpRight } from "lucide-react";
import { Avatar, Badge } from "../../components";
import type { ClinicState, RecordItem } from "../../data";
import type { SessionData } from "./model";
import { packageBalance } from "./services";
import { courseBalance } from "../clinical/services";
import { money } from "../../data";
export default function SessionContext({
  state,
  record,
  draft,
  previous,
  onPatient,
  onCourse,
  onPrevious,
}: {
  state: ClinicState;
  record: RecordItem;
  draft: SessionData;
  previous?: RecordItem;
  onPatient: () => void;
  onCourse: () => void;
  onPrevious: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const p = state.patients.find((p) => p.id === record.patientId),
    course = state.records["Treatment Plans"].find(
      (c) => c.id === record.courseId,
    ),
    balance = packageBalance(state, record);
  return (
    <aside className="session-context">
      <section className="card">
        <div className="session-context-identity">
          <button className="patient-cell" onClick={onPatient}>
            <Avatar name={record.name} />
            <span>
              <strong>{record.name}</strong>
              <small>
                {record.patientId} · {p?.age} years
              </small>
            </span>
            <ArrowUpRight size={12} />
          </button>
          <Badge>{p?.status || "Patient linked"}</Badge>
        </div>
        {p?.clinical?.alerts.length ? (
          <div className="session-warning">
            <AlertTriangle size={16} />
            <div>
              <strong>Clinician review required</strong>
              {p.clinical.alerts.map((a) => (
                <p key={a}>{a}</p>
              ))}
              <small>
                Recorded alerts · {p.clinical.reviewedBy || "Review pending"}
              </small>
            </div>
          </div>
        ) : (
          <div className="session-routine">
            <ShieldCheck size={15} />
            <p>
              No important alerts recorded. Confirm clinical history before
              starting.
            </p>
          </div>
        )}
        <button
          className="text-button session-context-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? "Collapse clinical context"
            : "Review history, reactions & consent"}
        </button>
        <dl
          className={"session-context-details" + (expanded ? " expanded" : "")}
        >
          {[
            ["Allergies", p?.clinical?.allergies],
            ["Relevant history", p?.clinical?.history],
            ["Medication", p?.clinical?.medications],
            ["Previous procedures", p?.clinical?.procedures],
            [
              "Previous reaction",
              previous?.session?.reaction === "Observed"
                ? previous.session.reactionNotes
                : previous?.session?.reaction === "None observed"
                  ? "None observed in previous documentation"
                  : "Not recorded — clinician review required",
            ],
            [
              "Required consent",
              course?.course?.consent || "Relevant treatment-specific consent",
            ],
            ["Treatment area", draft.area || "Enter clinician-approved area"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v || "Not recorded"}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="card session-course-context">
        <h3>Active treatment context</h3>
        {course ? (
          <>
            <button className="text-button" onClick={onCourse}>
              {course.course?.treatmentName || course.detail}
              <ArrowUpRight size={12} />
            </button>
            <small>{course.id}</small>
            <Badge>{course.status}</Badge>
            <div className="session-balance-chips">
              <span>
                <strong>{balance?.used}</strong>completed
              </span>
              <span>
                <strong>{balance?.remaining}</strong>remaining
              </span>
            </div>
            <p>{money(courseBalance(state, course))} outstanding</p>
            <small>
              Package validity · {course.course?.validUntil || "Not recorded"}
            </small>
          </>
        ) : (
          <p>Single visit · no package deduction.</p>
        )}
      </section>
      <section className="card session-previous-context">
        <h3>Previous sitting</h3>
        {previous ? (
          <>
            <Badge>{previous.status}</Badge>
            <strong>
              Sitting {previous.session?.number} · {previous.date}
            </strong>
            <p>{previous.session?.procedureNotes || previous.detail}</p>
            <button className="button secondary" onClick={onPrevious}>
              Compare recorded parameters
              <ArrowUpRight size={12} />
            </button>
          </>
        ) : (
          <p>
            No earlier completed sitting exists for this patient/course.
            Previous settings are not inferred.
          </p>
        )}
      </section>
    </aside>
  );
}
