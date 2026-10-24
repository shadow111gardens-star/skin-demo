import { normalizedPhone } from "../../patientServices";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Avatar, Badge, Modal } from "../../components";
import { DEMO_DATE, type RecordItem } from "../../data";
import { useClinic } from "../../store";
import { inr } from "../finance/ledger";
import { Metrics, Empty, DetailList } from "../operations/OperationsUI";
import AppointmentForm from "../scheduling/AppointmentForm";
import { leadStages } from "./model";
import { leadMatches, linkLeadBooking } from "./services";
import {
  LeadEditor,
  LeadStageForm,
  ContactForm,
  ConvertLeadForm,
} from "./LeadForms";
function LeadCard({ lead, onOpen }: { lead: RecordItem; onOpen: () => void }) {
  const { state } = useClinic(),
    d = lead.lead!;
  return (
    <button className="crm-lead-card" onClick={onOpen}>
      <div className="operations-split">
        <span className="crm-identity">
          <Avatar name={lead.name} small />
          <strong>{lead.name}</strong>
        </span>
        <strong className="crm-value">{inr(lead.amount)}</strong>
      </div>
      <small>
        {d.phone} ·{" "}
        {
          state.records["Treatment Catalogue"].find(
            (t) => t.id === d.treatmentId,
          )?.name
        }
      </small>
      <div className="crm-card-meta">
        <span>{d.source}</span>
        <span>{d.assignedTo}</span>
      </div>
      <div className="crm-card-meta">
        <span>Last contact: {d.lastContact || "Not recorded"}</span>
        <span
          className={
            d.nextFollowup && d.nextFollowup < DEMO_DATE ? "crm-overdue" : ""
          }
        >
          Next: {d.nextFollowup || "Not scheduled"}
        </span>
      </div>
      {lead.patientId && <small>Linked patient · {lead.patientId}</small>}
    </button>
  );
}
function LeadDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, setState, notify } = useClinic(),
    navigate = useNavigate(),
    [action, setAction] = useState("");
  const r = state.records["Leads & Enquiries"].find((r) => r.id === id);
  if (!r?.lead) return null;
  const d = r.lead,
    patient = state.patients.find((p) => p.id === r.patientId),
    matches = leadMatches(state, r),
    closed = ["Won", "Lost"].includes(r.status);
  return (
    <>
      <Modal
        title={r.name + " · Enquiry"}
        className="crm-drawer"
        onClose={onClose}
      >
        <div className="operations-split">
          <Badge>{r.status}</Badge>
          <strong>{inr(r.amount)} estimated</strong>
        </div>
        <p className="crm-note">
          Staff-entered pipeline stage. Estimated value is not invoiced revenue
          or money collected.
        </p>
        <div className="operations-actions">
          <button className="button" onClick={() => setAction("edit")}>
            Edit enquiry
          </button>
          <button className="button" onClick={() => setAction("stage")}>
            Move stage
          </button>
          {!closed && (
            <button className="button" onClick={() => setAction("contact")}>
              Log contact
            </button>
          )}
          {patient ? (
            <Link className="button primary" to={"/patients/" + patient.id}>
              Open patient {patient.id}
            </Link>
          ) : (
            r.status !== "Lost" && (
              <button
                className="button primary"
                onClick={() => setAction("convert")}
              >
                Convert to patient
              </button>
            )
          )}
          {patient && !closed && (
            <button className="button" onClick={() => setAction("book")}>
              Book consultation
            </button>
          )}
        </div>
        <DetailList
          items={[
            ["Mobile", d.phone],
            ["Email", d.email],
            [
              "Interested treatment",
              state.records["Treatment Catalogue"].find(
                (t) => t.id === d.treatmentId,
              )?.name,
            ],
            ["Source", d.source],
            ["Assigned employee", d.assignedTo],
            ["Enquiry date", d.createdDate],
            ["Last contact", d.lastContact || "Not recorded"],
            ["Next follow-up", d.nextFollowup || "Not scheduled"],
            ["Patient linkage", patient?.id || "Not converted"],
            ["Notes", d.notes],
          ]}
        />
        {d.appointmentId && (
          <Link
            className="button"
            to={"/appointments?appointment=" + d.appointmentId}
          >
            Open linked appointment
          </Link>
        )}
        {!patient && matches.length > 0 && (
          <div className="crm-match">
            <strong>{matches.length} likely existing patient match(es)</strong>
            <p>Review and reuse the existing patient during conversion.</p>
            <button className="button" onClick={() => setAction("convert")}>
              Review matches
            </button>
          </div>
        )}
        <h3>Contact history</h3>
        {d.contacts.map((c) => (
          <article className="operations-movement" key={c.id}>
            <strong>
              {c.method} · {c.outcome}
            </strong>
            <small>
              {c.date} · {c.employee}
            </small>
            <p>{c.note}</p>
          </article>
        ))}
        {!d.contacts.length && <Empty>No contact outcomes recorded.</Empty>}
        <h3>Enquiry timeline</h3>
        {d.events
          .slice()
          .reverse()
          .map((e) => (
            <article className="operations-movement" key={e.id}>
              <strong>
                {e.action} · {e.stage}
              </strong>
              <small>
                {e.date} · {e.employee}
              </small>
              <p>{e.note}</p>
            </article>
          ))}
      </Modal>
      {action === "edit" && (
        <LeadEditor record={r} onClose={() => setAction("")} />
      )}
      {action === "stage" && (
        <LeadStageForm record={r} onClose={() => setAction("")} />
      )}
      {action === "contact" && (
        <ContactForm record={r} onClose={() => setAction("")} />
      )}
      {action === "convert" && (
        <ConvertLeadForm
          record={r}
          onClose={() => setAction("")}
          onConverted={(id) => navigate("/patients/" + id)}
        />
      )}
      {action === "book" && (
        <AppointmentForm
          initialPatientId={patient?.id}
          source="CRM enquiry"
          onClose={() => setAction("")}
          onSaved={(a) => {
            setState((s) => linkLeadBooking(s, r.id, a.id));
            notify("Appointment linked to the enquiry");
          }}
        />
      )}
    </>
  );
}
export default function Leads() {
  const { state } = useClinic(),
    [params, setParams] = useSearchParams(),
    [q, setQ] = useState(params.get("q") || ""),
    [stage, setStage] = useState(params.get("stage") || ""),
    [source, setSource] = useState(""),
    [employee, setEmployee] = useState(""),
    [followup, setFollowup] = useState(""),
    [view, setView] = useState<"board" | "list">("board"),
    [create, setCreate] = useState(false);
  const [compact, setCompact] = useState(() => window.innerWidth < 900);
  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia("(max-width: 899px)");
    const sync = () => setCompact(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const leads = state.records["Leads & Enquiries"],
    rows = leads
      .filter(
        (r) =>
          r.lead &&
          ((
            r.name +
            " " +
            r.lead.phone +
            " " +
            r.lead.email +
            " " +
            r.id +
            " " +
            state.records["Treatment Catalogue"].find(
              (t) => t.id === r.lead?.treatmentId,
            )?.name
          )
            .toLowerCase()
            .includes(q.trim().toLowerCase()) ||
            (q.replace(/\D/g, "").length >= 3 &&
              normalizedPhone(r.lead.phone).includes(
                q.replace(/\D/g, "").slice(-10),
              ))) &&
          (!stage || r.status === stage) &&
          (!source || r.lead.source === source) &&
          (!employee || r.lead.assignedTo === employee) &&
          (!followup ||
            (followup === "overdue"
              ? !!r.lead.nextFollowup && r.lead.nextFollowup < DEMO_DATE
              : r.lead.nextFollowup === DEMO_DATE)),
      )
      .sort((a, b) =>
        (a.lead?.nextFollowup || "9999").localeCompare(
          b.lead?.nextFollowup || "9999",
        ),
      );
  const open = (id: string) =>
      setParams({ ...Object.fromEntries(params), lead: id }),
    selected = params.get("lead") || params.get("record") || "",
    close = () => {
      const next = new URLSearchParams(params);
      next.delete("lead");
      next.delete("record");
      setParams(next);
    };
  const list = (
    <div className="crm-list">
      {rows.map((r) => (
        <article className="card" key={r.id}>
          <div className="crm-list-stage">
            <Badge>{r.status}</Badge>
          </div>
          <LeadCard lead={r} onOpen={() => open(r.id)} />
        </article>
      ))}
    </div>
  );
  return (
    <div className="crm-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">PATIENT RELATIONSHIPS</span>
          <h1>Leads & Enquiries</h1>
          <p>Thoughtful follow-through, from first enquiry to ongoing care.</p>
        </div>
        <button className="button primary" onClick={() => setCreate(true)}>
          + New enquiry
        </button>
      </div>
      <p className="crm-note">
        Fictional CRM records · pipeline stages are staff-entered. Contacts are
        logged manually; no messages are sent.
      </p>
      <Metrics
        items={[
          ["Filtered enquiries", rows.length],
          [
            "Open estimated pipeline",
            inr(
              rows
                .filter((r) => !["Won", "Lost"].includes(r.status))
                .reduce((n, r) => n + r.amount, 0),
            ),
          ],
          [
            "Follow-ups overdue",
            rows.filter(
              (r) =>
                r.lead?.nextFollowup &&
                r.lead.nextFollowup < DEMO_DATE &&
                !["Won", "Lost"].includes(r.status),
            ).length,
          ],
          ["Linked patients", rows.filter((r) => r.patientId).length],
        ]}
      />
      <section className="card operations-filters">
        <label>
          Search enquiries
          <input
            aria-label="Search enquiries"
            placeholder="Name, mobile, email or treatment"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        {(
          [
            ["Stage", stage, setStage, [...leadStages]],
            [
              "Source",
              source,
              setSource,
              [...new Set(leads.map((r) => r.lead!.source))],
            ],
            [
              "Employee",
              employee,
              setEmployee,
              [...new Set(leads.map((r) => r.lead!.assignedTo))],
            ],
          ] as const
        ).map(([name, value, set, values]) => (
          <label key={name}>
            {name}
            <select
              aria-label={"Lead " + name.toLowerCase() + " filter"}
              value={value}
              onChange={(e) => set(e.target.value)}
            >
              <option value="">All {name.toLowerCase()}s</option>
              {values.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        ))}
        <label>
          Next follow-up
          <select
            aria-label="Lead follow-up filter"
            value={followup}
            onChange={(e) => setFollowup(e.target.value)}
          >
            <option value="">All dates</option>
            <option value="today">Due today</option>
            <option value="overdue">Overdue</option>
          </select>
        </label>
        <button
          className="button"
          onClick={() => {
            setQ("");
            setStage("");
            setSource("");
            setEmployee("");
            setFollowup("");
          }}
        >
          Reset
        </button>
      </section>
      <div className="crm-view-controls">
        <span>
          {rows.length} enquiries · {DEMO_DATE} operating day
        </span>
        <div className="operations-tabs" aria-label="Pipeline view">
          <button
            className={"crm-board-toggle " + (view === "board" ? "active" : "")}
            aria-pressed={view === "board"}
            onClick={() => setView("board")}
          >
            Pipeline board
          </button>
          <button
            className={view === "list" ? "active" : ""}
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            List view
          </button>
        </div>
      </div>
      {!rows.length ? (
        <section className="card">
          <Empty>
            No enquiries match these filters. Reset filters or add an enquiry.
          </Empty>
        </section>
      ) : view === "list" || compact ? (
        list
      ) : (
        <>
          <div
            className="crm-board"
            role="region"
            aria-label="Lead pipeline board"
            tabIndex={0}
          >
            <div className="crm-board-track">
              {leadStages
                .filter((s) => !stage || s === stage)
                .map((s) => {
                  const group = rows.filter((r) => r.status === s);
                  return (
                    <section className="crm-column" key={s}>
                      <header>
                        <strong>{s}</strong>
                        <span>{group.length}</span>
                        <small>
                          {inr(group.reduce((n, r) => n + r.amount, 0))}{" "}
                          estimated
                        </small>
                      </header>
                      {group.map((r) => (
                        <LeadCard
                          key={r.id}
                          lead={r}
                          onOpen={() => open(r.id)}
                        />
                      ))}
                      {!group.length && (
                        <p className="crm-column-empty">
                          No enquiries in this stage
                        </p>
                      )}
                    </section>
                  );
                })}
            </div>
          </div>
        </>
      )}
      {selected && <LeadDrawer key={selected} id={selected} onClose={close} />}
      {create && <LeadEditor onClose={() => setCreate(false)} />}
    </div>
  );
}
