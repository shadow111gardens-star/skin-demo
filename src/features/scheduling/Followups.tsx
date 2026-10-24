import { useSearchParams } from "react-router-dom";
import { Search, ArrowUpRight, Clock, CheckCircle2 } from "lucide-react";
import { useClinic } from "../../store";
import { Avatar, Badge } from "../../components";
import { DEMO_DATE } from "../../data";
import type { Role } from "../../auth";
import { safeDate, addDays } from "../../services";
import { followupTabs, type FollowupTab } from "./model";
import {
  followupRows,
  inFollowupTab,
  followupData,
  reminderPaused,
  suggestedDate,
} from "./services";
import FollowupDetail from "./FollowupDetail";
export default function Followups({ role }: { role: Role }) {
  const { state } = useClinic(),
    [params, setParams] = useSearchParams();
  const selected = params.get("record") || "";
  const date = safeDate(params.get("date")),
    tab = (params.get("tab") ||
      (params.get("status") === "Overdue"
        ? "Overdue"
        : "Due Today")) as FollowupTab,
    q = params.get("q") || "",
    employee = params.get("employee") || "All",
    outcome = params.get("outcome") || "Open",
    sort = params.get("sort") || "Due date";
  const all = followupRows(state, date),
    change = (key: string, value: string) => {
      const n = new URLSearchParams(params);
      n.set(key, value);
      setParams(n, { replace: true });
    };
  const rows = all
    .filter(
      (r) =>
        (outcome === "All outcomes" || outcome === "Resolved"
          ? outcome === "All outcomes" || r.status === "Completed"
          : outcome === "Declined"
            ? r.status === "Declined" || followupData(r).outcome === "Declined"
            : inFollowupTab(state, r, tab, date)) &&
        (employee === "All" || followupData(r).assignedTo === employee) &&
        `${r.name} ${r.patientId} ${r.detail} ${r.courseId || ""}`
          .toLowerCase()
          .includes(q.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "Patient"
        ? a.name.localeCompare(b.name)
        : sort === "Latest contact"
          ? (followupData(b).contacts[0]?.at || "").localeCompare(
              followupData(a).contacts[0]?.at || "",
            )
          : (a.dueDate || "").localeCompare(b.dueDate || ""),
    );
  const r = all.find((r) => r.id === selected);
  return (
    <div className="followups-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE NEXT STEP IN EVERY CARE JOURNEY</div>
          <h1>Follow-ups</h1>
          <p>A considered follow-up, with a clear owner and next action.</p>
        </div>
        <label className="followup-reference-date">
          Reference date
          <input
            aria-label="Follow-up reference date"
            type="date"
            value={date}
            onChange={(e) => change("date", e.target.value)}
          />
        </label>
      </div>
      <div className="followup-summary">
        {[
          {
            label: "Due today",
            n: all.filter((r) => inFollowupTab(state, r, "Due Today", date))
              .length,
            tab: "Due Today",
            Icon: Clock,
          },
          {
            label: "Overdue",
            n: all.filter((r) => inFollowupTab(state, r, "Overdue", date))
              .length,
            tab: "Overdue",
            Icon: Clock,
          },
          {
            label: "Clinician review",
            n: all.filter((r) =>
              inFollowupTab(state, r, "Reaction Requiring Review", date),
            ).length,
            tab: "Reaction Requiring Review",
            Icon: CheckCircle2,
          },
        ].map((c) => (
          <button key={c.label} onClick={() => change("tab", c.tab)}>
            <c.Icon size={17} />
            <strong>{c.n}</strong>
            <span>{c.label}</span>
          </button>
        ))}
      </div>
      <nav className="followup-tabs" aria-label="Follow-up categories">
        {followupTabs.map((t) => (
          <button
            aria-current={t === tab ? "page" : undefined}
            key={t}
            onClick={() => {
              const n = new URLSearchParams(params);
              n.set("tab", t);
              n.set("outcome", "Open");
              setParams(n);
            }}
          >
            {t}
            <span>
              {all.filter((r) => inFollowupTab(state, r, t, date)).length}
            </span>
          </button>
        ))}
      </nav>
      <section className="card followup-list">
        <div className="followup-filters">
          <div className="search-field">
            <Search size={15} />
            <input
              aria-label="Search follow-ups"
              value={q}
              onChange={(e) => change("q", e.target.value)}
              placeholder="Search patient, ID or reason…"
            />
          </div>
          <select
            aria-label="Assigned employee filter"
            value={employee}
            onChange={(e) => change("employee", e.target.value)}
          >
            <option>All</option>
            {[...new Set(all.map((r) => followupData(r).assignedTo))].map(
              (e) => (
                <option key={e}>{e}</option>
              ),
            )}
          </select>
          <select
            aria-label="Follow-up outcome filter"
            value={outcome}
            onChange={(e) => change("outcome", e.target.value)}
          >
            {["Open", "All outcomes", "Resolved", "Declined"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select
            aria-label="Sort follow-ups"
            value={sort}
            onChange={(e) => change("sort", e.target.value)}
          >
            {["Due date", "Patient", "Latest contact"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <button className="text-button" onClick={() => setParams({ date })}>
            Reset filters
          </button>
        </div>
        <div className="followup-table-head">
          <span>Patient / course</span>
          <span>Last sitting / recommended</span>
          <span>Contact & next action</span>
          <span>Status</span>
          <span />
        </div>
        {rows.map((r) => {
          const d = followupData(r),
            c = state.records["Treatment Plans"].find(
              (c) => c.id === r.courseId,
            ),
            last = state.records["Sittings & Sessions"]
              .filter(
                (v) =>
                  v.patientId === r.patientId &&
                  (!r.courseId || v.courseId === r.courseId) &&
                  v.status === "Completed",
              )
              .sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0],
            actual =
              state.appointments.find(
                (a) => a.id === (r.appointmentId || d.appointmentId),
              ) ||
              state.appointments
                .filter(
                  (a) =>
                    a.patientId === r.patientId &&
                    (!r.courseId || a.courseId === r.courseId) &&
                    a.date >= date &&
                    ![
                      "Cancelled",
                      "No-show",
                      "Completed",
                      "Waiting list",
                    ].includes(a.status),
                )
                .sort((a, b) =>
                  (a.date + a.time).localeCompare(b.date + b.time),
                )[0];
          return (
            <article className="followup-row" key={r.id}>
              <div className="followup-person">
                <Avatar name={r.name} />
                <div>
                  <strong>{r.name}</strong>
                  <small>{r.patientId}</small>
                  <span>
                    {c?.course?.treatmentName ||
                      r.followupKind ||
                      "Patient review"}
                  </span>
                </div>
              </div>
              <div>
                <small>Last sitting · {last?.date || "Not recorded"}</small>
                <strong
                  className={r.status === "Overdue" ? "overdue-text" : ""}
                >
                  {r.dueDate || suggestedDate(state, r)}
                </strong>
                <small>
                  {actual
                    ? `Booked ${actual.date} · ${actual.time}`
                    : "No appointment booked"}
                </small>
                <span>{r.detail}</span>
              </div>
              <div>
                <strong>{d.assignedTo}</strong>
                <small>
                  {d.contacts[0]
                    ? d.contacts[0].action +
                      " · " +
                      new Date(d.contacts[0].at).toLocaleDateString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })
                    : "No contact recorded"}
                </small>
                <span>{d.nextAction}</span>
                {reminderPaused(state, r) && (
                  <small className="overdue-text">
                    Routine reminders paused
                  </small>
                )}
              </div>
              <div>
                <Badge>{r.status}</Badge>
                <small>{d.outcome}</small>
              </div>
              <button
                className="button secondary"
                aria-label={"Open follow-up " + r.id}
                onClick={() => change("record", r.id)}
              >
                Review <ArrowUpRight size={13} />
              </button>
            </article>
          );
        })}
        {!rows.length && (
          <div className="empty">
            <CheckCircle2 size={27} />
            <h3>No follow-ups in this view</h3>
            <p>Try another category, reference date or outcome filter.</p>
          </div>
        )}
        <footer className="calendar-legend">
          {rows.length} records · Due soon is within 7 days, through{" "}
          {addDays(date, 7)} · Demo operating day {DEMO_DATE}. Contact actions
          are documented; delivery is never assumed.
        </footer>
      </section>
      {r && (
        <FollowupDetail
          key={r.id}
          record={r}
          role={role}
          onClose={() => {
            const n = new URLSearchParams(params);
            n.delete("record");
            setParams(n, { replace: true });
          }}
        />
      )}
    </div>
  );
}
